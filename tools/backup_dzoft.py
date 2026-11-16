#!/usr/bin/env python3
"""DZOFT off-site encrypted backup helper.

This tool never writes production SQL to GitHub or to a plaintext SQL file.
Run locally on a trusted computer with the Supabase CLI and cryptography.
The CLI's Storage copy needs a temporary directory; use an encrypted disk.
This is an application-data export, NOT a verified full Supabase Auth restore.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import getpass
import hashlib
import io
import json
import os
import re
from pathlib import Path, PurePosixPath
import secrets
import stat
import shutil
import subprocess
import sys
import tempfile
import zipfile

try:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
except ImportError as exc:
    raise SystemExit("Install required library locally: python -m pip install cryptography") from exc

PROJECT_REF = "rzghbvmszbjlqkdjzpxc"
MAGIC = b"DZOFTBK1"
SALT_SIZE = 16
NONCE_SIZE = 12
MAX_ARCHIVE_BYTES = 256 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 10000
MAX_MANIFEST_BYTES = 256 * 1024
REQUIRED_DATABASE_FILES = frozenset({
    "database/schema.sql", "database/data.sql", "database/roles.sql"
})
BUCKET = "client-files"
PROJECT_ROOT = Path(__file__).resolve().parents[1]


class BackupError(RuntimeError):
    pass


def sha(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def key_for(password: str, salt: bytes) -> bytes:
    if not password:
        raise BackupError("An encryption password is required.")
    return Scrypt(salt=salt, length=32, n=2**15, r=8, p=1).derive(password.encode("utf-8"))


def seal(plain: bytes, password: str) -> bytes:
    salt, nonce = secrets.token_bytes(SALT_SIZE), secrets.token_bytes(NONCE_SIZE)
    return MAGIC + salt + nonce + AESGCM(key_for(password, salt)).encrypt(
        nonce, plain, MAGIC
    )


def unseal(archive: bytes, password: str) -> bytes:
    prefix = len(MAGIC)
    if len(archive) <= prefix + SALT_SIZE + NONCE_SIZE + 16 or archive[:prefix] != MAGIC:
        raise BackupError("Not a DZOFT encrypted backup or file is truncated.")
    salt = archive[prefix:prefix + SALT_SIZE]
    nonce = archive[prefix + SALT_SIZE:prefix + SALT_SIZE + NONCE_SIZE]
    try:
        return AESGCM(key_for(password, salt)).decrypt(
            nonce, archive[prefix + SALT_SIZE + NONCE_SIZE:], MAGIC
        )
    except InvalidTag as exc:
        raise BackupError("Wrong passphrase or corrupted archive.") from exc


def password_prompt(confirm: bool) -> str:
    password = getpass.getpass("Backup encryption passphrase (never stored): ")
    if confirm:
        if len(password) < 16:
            raise BackupError("Choose a unique passphrase of at least 16 characters.")
        if getpass.getpass("Repeat encryption passphrase: ") != password:
            raise BackupError("Passphrases do not match.")
    return password


def run_cli(arguments: list[str], *, binary: bool = False,
            cwd: Path | None = None) -> bytes:
    executable = shutil.which(os.environ.get("DZOFT_SUPABASE_CLI", "supabase"))
    if not executable:
        raise BackupError("Supabase CLI not installed. See docs/backup-recovery.md.")
    command = [executable] + arguments
    # Keep Supabase's interactive login/password prompts visible on the owner's PC.
    # Only the SQL payload on stdout is captured; never print it to the terminal.
    result = subprocess.run(command, cwd=cwd if cwd is not None else PROJECT_ROOT, stdin=sys.stdin,
                            stdout=subprocess.PIPE, stderr=None, check=False)
    if result.returncode != 0:
        # Do not echo full stderr: CLI logs may include connection details.
        # Report the safe command group only, not CLI arguments, connection
        # strings, tokens, remote filenames, or raw stderr.
        operation = " ".join(arguments[:2])
        raise BackupError(
            "Supabase CLI operation " + operation + " failed (exit " +
            str(result.returncode) + "). Check its error immediately above. "
            "No backup was marked successful."
        )
    return result.stdout


def select_remote_flags(group: list[str], *, explicit_ref: bool = False) -> list[str]:
    """Choose flags supported by the installed Supabase CLI (v2 or v3+).

    CLI v3 uses --remote and deprecates --linked; older releases require
    --linked. Never permit an unqualified local-stack dump.
    """
    help_text = run_cli(group + ["--help"]).decode("utf-8", "replace")
    if re.search(r"(?m)^\s*--remote\b", help_text):
        # Always bind to RD-Clients explicitly, including commands executed
        # from a separate private temporary directory. Bare --remote uses a
        # linked ref discovered from cwd and can fail or select a wrong project.
        return ["--remote=" + PROJECT_REF]
    if re.search(r"(?m)^\s*--linked\b", help_text):
        return ["--linked"]
    raise BackupError(
        "No supported explicit remote target flag was found in the Supabase "
        "CLI help. Upgrade the CLI; refusing to export the local/wrong database."
    )


def ensure_destination(destination: Path) -> Path:
    destination = destination.expanduser().resolve()
    for ancestor in (destination,) + tuple(destination.parents):
        if (ancestor / ".git").exists():
            raise BackupError("Refusing to save a customer backup inside any Git repository.")
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    return destination


def build_zip(members: dict[str, bytes], project_ref: str, storage: dict) -> bytes:
    manifest = {
        "format": "DZOFT application export v1",
        "project_ref": project_ref,
        "captured_at_utc": datetime.now(timezone.utc).isoformat(),
        "files": {name: {"size": len(blob), "sha256": sha(blob)}
                  for name, blob in sorted(members.items())},
        "storage": storage,
        "limitations": [
            "Schema/data exports include public and private application schemas but exclude managed Auth and Storage schemas.",
            "An isolated database restore drill remains necessary.",
            "The archive is not a live backup until exported off the computer."
        ]
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for name, blob in sorted(members.items()):
            z.writestr(name, blob)
        z.writestr("MANIFEST.json", json.dumps(manifest, indent=2).encode())
    return buffer.getvalue()


def verified_archive(archive: bytes, passphrase: str) -> tuple[bytes, dict]:
    """Authenticate and validate the entire app-data archive before any extraction.

    A valid AES-GCM tag authenticates the ZIP payload; the checks below also
    reject malformed/partial backups, duplicate entries, unsafe paths and
    resource-exhaustion archives. This is NOT proof of database restorability.
    """
    if len(archive) > MAX_ARCHIVE_BYTES + len(MAGIC) + SALT_SIZE + NONCE_SIZE + 16:
        raise BackupError("Encrypted archive exceeds the verification size limit.")
    plain = unseal(archive, passphrase)
    if len(plain) > MAX_ARCHIVE_BYTES:
        raise BackupError("Backup exceeds the safe verification memory limit.")
    try:
        with zipfile.ZipFile(io.BytesIO(plain)) as z:
            entries = z.infolist()
            if len(entries) > MAX_ARCHIVE_ENTRIES:
                raise BackupError("Archive contains too many entries.")
            names = [item.filename for item in entries]
            if len(set(names)) != len(names) or "MANIFEST.json" not in names:
                raise BackupError("Duplicate archive entries or manifest missing.")
            size_total = 0
            for item in entries:
                path = PurePosixPath(item.filename)
                if (not item.filename or item.filename.startswith("/") or
                    "\\" in item.filename or ".." in path.parts or
                    item.is_dir() or
                    (item.create_system == 3 and
                     stat.S_IFMT(item.external_attr >> 16) == stat.S_IFLNK)):
                    raise BackupError("Unsafe archive entry.")
                if item.filename != "MANIFEST.json" and not (
                    item.filename.startswith("database/") or
                    item.filename.startswith("storage/")
                ):
                    raise BackupError("Unknown file location inside archive.")
                size_total += item.file_size
                if size_total > MAX_UNCOMPRESSED_BYTES:
                    raise BackupError("Archive expands beyond the verification limit.")
            manifest_entry = z.getinfo("MANIFEST.json")
            if manifest_entry.file_size > MAX_MANIFEST_BYTES:
                raise BackupError("Backup manifest is unexpectedly large.")
            manifest = json.loads(z.read(manifest_entry))
            if not isinstance(manifest, dict) or manifest.get("project_ref") != PROJECT_REF:
                raise BackupError("Backup project does not match RD-Clients.")
            if manifest.get("format") != "DZOFT application export v1":
                raise BackupError("Unknown DZOFT archive format.")
            declared = manifest.get("files")
            if not isinstance(declared, dict):
                raise BackupError("Backup manifest has no valid file inventory.")
            actual = set(names) - {"MANIFEST.json"}
            if actual != set(declared):
                raise BackupError("Archive file list does not match its manifest.")
            sql_split = REQUIRED_DATABASE_FILES.issubset(actual)
            native_custom = "database/application.dump" in actual
            if not sql_split and not native_custom:
                raise BackupError("Database schema, data or roles are missing; native PostgreSQL dump missing.")
            if sql_split and native_custom:
                raise BackupError("Archive must not mix split SQL and native PostgreSQL custom dump.")
            if native_custom and not z.read("database/application.dump").startswith(b"PGDMP"):
                raise BackupError("Native PostgreSQL custom dump header is invalid.")
            for name, item in declared.items():
                if (not isinstance(item, dict) or type(item.get("size")) is not int or
                    item["size"] < 0 or
                    not isinstance(item.get("sha256"), str) or
                    not re.fullmatch(r"[0-9a-f]{64}", item["sha256"])):
                    raise BackupError("Invalid file manifest entry.")
                data = z.read(name)
                if len(data) != item["size"] or sha(data) != item["sha256"]:
                    raise BackupError("SHA-256 verification failed for " + name)
            if z.testzip() is not None:
                raise BackupError("A backup member failed its CRC integrity check.")
            storage = manifest.get("storage")
            if not isinstance(storage, dict) or storage.get("bucket") != BUCKET:
                raise BackupError("Storage manifest is missing or names another bucket.")
            storage_count = storage.get("files")
            if type(storage_count) is not int or storage_count < 0:
                raise BackupError("Storage file count is invalid.")
            exported = sum(name.startswith("storage/client-files/") for name in actual)
            status = storage.get("status")
            if status == "exported":
                if exported == 0 or storage_count != exported:
                    raise BackupError("Storage download count does not match manifest.")
            elif status in ("verified_empty_by_cli", "verified_empty_by_sql", "skipped_by_operator"):
                if exported or storage_count:
                    raise BackupError("Unexpected Storage files in partial/empty backup.")
            else:
                raise BackupError("Unknown Storage export state.")
            if sql_split and (not z.read("database/schema.sql").strip() or
                              not z.read("database/data.sql").strip()):
                raise BackupError("Database schema or data export is empty.")
    except BackupError:
        raise
    except (KeyError, TypeError, zipfile.BadZipFile, zipfile.LargeZipFile, RuntimeError) as exc:
        raise BackupError("Malformed or incomplete DZOFT archive.") from exc
    return plain, manifest


def do_backup(args: argparse.Namespace) -> None:
    dest = ensure_destination(args.destination)
    ref = PROJECT_REF
    print("Target: RD-Clients (" + ref + ")")
    print("This operation reads data. It does not edit any client, payment or email.")
    password = password_prompt(confirm=True)

    # Explicit project linkage protects even when run from an unrelated folder.
    # Detect v3+ --remote vs. the older --linked CLI flag; never target local.
    print("Linking Supabase CLI to the exact RD-Clients project…")
    run_cli(["link", "--project-ref", ref])
    dump_flags = select_remote_flags(["db", "dump"], explicit_ref=True)
    print("Exporting schema, application data and role definitions…")
    exports = {
        "database/schema.sql": run_cli(["db", "dump"] + dump_flags + ["--schema=public,private"]),
        "database/data.sql": run_cli(["db", "dump"] + dump_flags + ["--schema=public,private", "--data-only", "--use-copy"]),
        "database/roles.sql": run_cli(["db", "dump"] + dump_flags + ["--role-only"]),
    }
    if not exports["database/schema.sql"] or not exports["database/data.sql"]:
        raise BackupError("Supabase returned an empty SQL dump; backup aborted.")

    expected_storage_count = args.expected_storage_count
    if expected_storage_count is not None:
        if expected_storage_count < 0:
            raise BackupError("Expected Storage count must be non-negative.")
        if args.skip_storage:
            raise BackupError("Do not specify expected Storage count with --skip-storage.")
    storage_metadata = {"bucket": BUCKET, "status": "not_exported", "files": 0}
    if not args.skip_storage:
        print("Checking Supabase Storage for client documents…")
        storage_ls_flags = select_remote_flags(["storage", "ls"])
        storage_cp_flags = select_remote_flags(["storage", "cp"])
        listing = run_cli(["storage", "ls", "-r", "ss:///" + BUCKET,
                           "--experimental"] + storage_ls_flags)
        exports["storage/remote-listing.txt"] = listing
        storage_metadata["listing_sha256"] = sha(listing)
        if listing.strip():
            if expected_storage_count is None:
                raise BackupError(
                    "Non-empty Storage requires --expected-storage-count from a "
                    "fresh read-only database inventory before exporting.")
            if expected_storage_count == 0:
                raise BackupError("Storage listing is non-empty but expected object count is zero.")
            print("Downloading Storage objects into temporary local directory…")
            print("CAUTION: temporary downloaded files are plaintext; use an encrypted disk.")
            with tempfile.TemporaryDirectory(prefix="dzoft-storage-") as scratch:
                # Supabase CLI v3 can interpret an absolute Windows destination
                # (e.g. C:\\Users\\...\\dzoft-storage-...) as an unsupported local
                # copy operation. Follow the documented remote-download syntax
                # with a relative "." destination inside the private temp folder.
                # NEVER change the remote bucket or run storage mv/rm here.
                base = Path(scratch)
                run_cli(["storage", "cp", "-r", "ss:///" + BUCKET, ".",
                         "--experimental"] + storage_cp_flags, cwd=base)
                files = [p for p in base.rglob("*") if p.is_file()]
                if len(files) != expected_storage_count:
                    raise BackupError(
                        "Storage download count differs from the independently verified "
                        "database object count. No complete archive will be created.")
                # Detect objects added, deleted or renamed during the download.
                listing_after = run_cli(["storage", "ls", "-r", "ss:///" + BUCKET,
                                         "--experimental"] + storage_ls_flags)
                if listing_after != listing:
                    raise BackupError(
                        "Storage listing changed during export. Retry with a fresh inventory.")
                for p in files:
                    if p.is_symlink():
                        raise BackupError("Refusing to read a symlink from downloaded Storage.")
                    # Check before read_bytes() to avoid loading unbounded user
                    # documents into this in-memory export helper.
                    projected = sum(len(blob) for blob in exports.values()) + p.stat().st_size
                    if projected > MAX_UNCOMPRESSED_BYTES:
                        raise BackupError("Storage exceeds the safe in-memory backup limit.")
                    rel = p.relative_to(base).as_posix()
                    exports["storage/client-files/" + rel] = p.read_bytes()
                storage_metadata.update({"status": "exported",
                                         "files": len(files)})
        else:
            if expected_storage_count not in (None, 0):
                raise BackupError("Storage listing is empty but database inventory has objects.")
            listing_after = run_cli(["storage", "ls", "-r", "ss:///" + BUCKET,
                                     "--experimental"] + storage_ls_flags)
            if listing_after != listing:
                raise BackupError("Storage listing changed during export. Retry the backup.")
            storage_metadata.update({"status": "verified_empty_by_cli", "files": 0})
    else:
        storage_metadata.update({"status": "skipped_by_operator", "files": 0})
        print("WARNING: Storage objects were deliberately not included.")

    plain = build_zip(exports, ref, storage_metadata)
    if len(plain) > MAX_ARCHIVE_BYTES:
        raise BackupError("Backup is too large for this memory-based helper. "
                          "Use the documented native PostgreSQL backup workflow.")
    secured = seal(plain, password)
    name = "dzoft-" + datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    name += "-" + secrets.token_hex(3) + ".dzoftbak"
    output = dest / name
    with output.open("xb") as out:
        out.write(secured)
    try:
        output.chmod(0o600)
    except OSError:
        pass
    try:
        _, manifest = verified_archive(output.read_bytes(), password)
    except Exception:
        output.unlink(missing_ok=True)
        raise
    print("ENCRYPTED, VERIFIED archive:", output)
    print("Database SQL exports:", 3)
    print("Storage export status:", manifest["storage"]["status"])
    if manifest["storage"]["status"] == "skipped_by_operator":
        print("WARNING: partial application backup — Storage was deliberately skipped.")
    print("WARNING: Supabase Auth accounts are not included in this application export.")
    print("Next: copy this encrypted file to a separate secure location.")
    print("Do not commit the archive or your passphrase to GitHub.")
    print("A full Auth/Storage restore has NOT yet been validated.")


def do_verify(args: argparse.Namespace) -> None:
    password = password_prompt(confirm=False)
    _, meta = verified_archive(Path(args.archive).expanduser().read_bytes(), password)
    print("PASS: encryption, archive CRC, file inventory and SHA-256 verified.")
    print("Created (UTC):", meta["captured_at_utc"])
    print("Files:", len(meta["files"]))
    print("Database format:", "native PostgreSQL custom" if "database/application.dump" in meta["files"] else "split SQL")
    print("Storage:", meta["storage"]["status"])
    if meta["storage"]["status"] == "skipped_by_operator":
        print("WARNING: database-only archive; Storage objects were not exported.")
    print("WARNING: Supabase managed Auth accounts are NOT included.")
    print("This checks archive integrity, not full database/identity restore success.")


def do_extract(args: argparse.Namespace) -> None:
    target = ensure_destination(args.destination)
    if any(target.iterdir()):
        raise BackupError("Extraction destination must be an empty folder.")
    password = password_prompt(confirm=False)
    plain, meta = verified_archive(Path(args.archive).expanduser().read_bytes(), password)
    with zipfile.ZipFile(io.BytesIO(plain)) as z:
        for name in meta["files"]:
            relative = PurePosixPath(name)
            if relative.is_absolute() or ".." in relative.parts:
                raise BackupError("Unsafe path inside archive.")
            dst = target.joinpath(*relative.parts)
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(z.read(name))
    print("Extracted plaintext data for isolated RESTORE TEST:", target)
    print("Keep this folder encrypted/restricted and delete securely after testing.")
    print("Never run a restore on the live Supabase database.")


def self_test() -> None:
    pwd = "fixture-passphrase-for-tests"
    payload = {"database/schema.sql": b"-- sample schema\\nCREATE TABLE example(id integer);\\n",
               "database/data.sql": b"INSERT INTO example VALUES (1);\\n",
               "database/roles.sql": b"-- sample roles\\n"}
    raw = seal(build_zip(payload, PROJECT_REF,
                         {"bucket": BUCKET, "status": "verified_empty_by_cli",
                          "files": 0}), pwd)
    _, info = verified_archive(raw, pwd)
    assert len(info["files"]) == 3
    for candidate in (raw[:-1] + bytes([raw[-1] ^ 1]),):
        try:
            verified_archive(candidate, pwd)
        except BackupError:
            pass
        else:
            raise AssertionError("Corrupted archive unexpectedly verified.")
    try:
        verified_archive(raw, "wrong-password")
    except BackupError:
        pass
    else:
        raise AssertionError("Incorrect passphrase unexpectedly verified.")
    print("PASS: fake-data encryption, decryption, tamper detection and checksums.")


def main() -> int:
    ap = argparse.ArgumentParser(description="Secure DZOFT Free-plan backup tool")
    cmds = ap.add_subparsers(dest="command", required=True)
    backup = cmds.add_parser("backup", help="Export and encrypt connected Supabase project")
    backup.add_argument("--destination", type=Path,
                        default=Path.home() / "DZOFT-Backups")
    backup.add_argument("--skip-storage", action="store_true",
                        help="Only for conscious database-only backups")
    backup.add_argument("--expected-storage-count", type=int, default=None,
                        help="Read-only SQL object count for client-files; required when non-empty")
    verify = cmds.add_parser("verify", help="Verify encrypted archive")
    verify.add_argument("archive", type=Path)
    extract = cmds.add_parser("extract", help="Extract SQL for an isolated restore test")
    extract.add_argument("archive", type=Path)
    extract.add_argument("--destination", required=True, type=Path)
    cmds.add_parser("self-test", help="Run synthetic encryption checks, no remote access")
    args = ap.parse_args()
    try:
        if args.command == "backup":
            do_backup(args)
        elif args.command == "verify":
            do_verify(args)
        elif args.command == "extract":
            do_extract(args)
        else:
            self_test()
        return 0
    except (BackupError, OSError, ValueError, zipfile.BadZipFile) as exc:
        print("ERROR:", str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
