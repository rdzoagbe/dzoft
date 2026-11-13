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
from pathlib import Path, PurePosixPath
import secrets
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
BUCKET = "client-files"


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


def run_cli(arguments: list[str], *, binary: bool = False) -> bytes:
    executable = shutil.which(os.environ.get("DZOFT_SUPABASE_CLI", "supabase"))
    if not executable:
        raise BackupError("Supabase CLI not installed. See docs/backup-recovery.md.")
    command = [executable] + arguments
    result = subprocess.run(command, stdin=sys.stdin, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=False)
    if result.returncode != 0:
        # Do not echo full stderr: CLI logs may include connection details.
        raise BackupError(
            "Supabase CLI command failed. Run 'supabase login', check access to "
            "the RD-Clients project, and check CLI help locally. "
            "No backup was marked successful."
        )
    return result.stdout


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
            "Supabase CLI db dump excludes managed Auth and Storage schemas by default.",
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
    plain = unseal(archive, passphrase)
    if len(plain) > MAX_ARCHIVE_BYTES:
        raise BackupError("Backup exceeds the safe verification memory limit.")
    with zipfile.ZipFile(io.BytesIO(plain)) as z:
        if z.testzip() is not None:
            raise BackupError("A backup member failed its CRC integrity check.")
        info = json.loads(z.read("MANIFEST.json"))
        if info.get("project_ref") != PROJECT_REF:
            raise BackupError("Backup project does not match RD-Clients.")
        actual = set(z.namelist()) - {"MANIFEST.json"}
        expected = set(info["files"])
        if actual != expected:
            raise BackupError("Archive file list does not match its manifest.")
        for name, item in info["files"].items():
            data = z.read(name)
            if len(data) != item["size"] or sha(data) != item["sha256"]:
                raise BackupError("SHA-256 verification failed for " + name)
    return plain, info


def do_backup(args: argparse.Namespace) -> None:
    dest = ensure_destination(args.destination)
    ref = PROJECT_REF
    print("Target: RD-Clients (" + ref + ")")
    print("This operation reads data. It does not edit any client, payment or email.")
    password = password_prompt(confirm=True)

    remote = "--remote=" + ref
    print("Exporting schema, application data and role definitions…")
    exports = {
        "database/schema.sql": run_cli(["db", "dump", remote]),
        "database/data.sql": run_cli(["db", "dump", remote, "--data-only", "--use-copy"]),
        "database/roles.sql": run_cli(["db", "dump", remote, "--role-only"]),
    }
    if not exports["database/schema.sql"] or not exports["database/data.sql"]:
        raise BackupError("Supabase returned an empty SQL dump; backup aborted.")

    storage_metadata = {"bucket": BUCKET, "status": "not_exported", "files": 0}
    if not args.skip_storage:
        print("Checking Supabase Storage for client documents…")
        listing = run_cli(["storage", "ls", "-r", "ss:///" + BUCKET,
                           "--experimental", remote])
        exports["storage/remote-listing.txt"] = listing
        storage_metadata["listing_sha256"] = sha(listing)
        if listing.strip():
            print("Downloading Storage objects into temporary local directory…")
            print("CAUTION: temporary downloaded files are plaintext; use an encrypted disk.")
            with tempfile.TemporaryDirectory(prefix="dzoft-storage-") as scratch:
                run_cli(["storage", "cp", "-r", "ss:///" + BUCKET, scratch,
                         "--experimental", remote])
                base = Path(scratch)
                files = [p for p in base.rglob("*") if p.is_file()]
                if not files:
                    raise BackupError(
                        "Storage listing was not empty, but no files were downloaded. "
                        "Aborting to avoid an incomplete backup.")
                for p in files:
                    rel = p.relative_to(base).as_posix()
                    exports["storage/client-files/" + rel] = p.read_bytes()
                storage_metadata.update({"status": "exported",
                                         "files": len(files)})
        else:
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
    print("Next: copy this encrypted file to a separate secure location.")
    print("Do not commit the archive or your passphrase to GitHub.")
    print("A full Auth/Storage restore has NOT yet been validated.")


def do_verify(args: argparse.Namespace) -> None:
    password = password_prompt(confirm=False)
    _, meta = verified_archive(Path(args.archive).expanduser().read_bytes(), password)
    print("PASS: encryption, archive CRC and SHA-256 files verified.")
    print("Created (UTC):", meta["captured_at_utc"])
    print("Files:", len(meta["files"]))
    print("Storage:", meta["storage"]["status"])
    print("This checks archive integrity, not database restore success.")


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
