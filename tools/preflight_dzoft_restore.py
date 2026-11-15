#!/usr/bin/env python3
"""DZOFT encrypted native PostgreSQL restore preflight (OFFLINE, no database access).

Decrypts and verifies one .dzoftbak in memory, then runs PostgreSQL pg_restore
ONLY in script/list modes. No SQL is written to disk, executed, printed, or
transmitted to Supabase. This does not establish that the DB can be restored.
"""
from __future__ import annotations

import argparse
from collections import Counter
import getpass
import io
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile

import backup_dzoft as backup
import backup_dzoft_native as native

# Only a pg_restore executable from an operator-specified local PostgreSQL bin
# directory is invoked. The command is never given --dbname / -d / -C / --clean.
MAX_SCHEMA_SQL_BYTES = 32 * 1024 * 1024
PG_RESTORE_TIMEOUT_SECONDS = 180
REQUIRED_SCHEMAS = frozenset(("public", "private"))
TOC_RE = re.compile(r"^\s*\d+;\s+\d+\s+\d+\s+(.+)$")


def pg_env() -> dict[str, str]:
    """Remove PostgreSQL connection settings even if caller has set them."""
    env = dict(os.environ)
    for key in list(env):
        if key.upper().startswith("PG"):
            env.pop(key, None)
    return env


def pg_restore_command(binary: str, mode: str) -> list[str]:
    if mode == "list":
        return [binary, "--list"]
    if mode == "schema":
        return [binary, "--schema-only", "--no-owner", "--no-privileges", "--file=-"]
    if mode == "render":
        return [binary, "--no-owner", "--no-privileges", "--file=-"]
    raise ValueError("Unknown offline PostgreSQL operation.")


def run_offline(binary: str, mode: str, blob: bytes) -> bytes:
    command = pg_restore_command(binary, mode)
    # There are deliberately NO connection or DB-selection options. PostgreSQL
    # reads the custom archive over stdin and writes scripts to stdout.
    result = subprocess.run(
        command,
        input=blob,
        stdout=subprocess.DEVNULL if mode == "render" else subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=pg_env(),
        check=False,
        timeout=PG_RESTORE_TIMEOUT_SECONDS,
    )
    if result.returncode:
        # Don't leak pg_restore stderr or possibly sensitive table/SQL contents.
        raise backup.BackupError(
            "Offline pg_restore " + mode + " check failed. "
            "Check the selected PostgreSQL version and archive validity. "
            "No SQL was executed or written to disk."
        )
    return result.stdout or b""


def audit_toc(listing: bytes) -> dict:
    """Return aggregate object counts only; never expose data or object names."""
    if len(listing) > MAX_SCHEMA_SQL_BYTES:
        raise backup.BackupError("PostgreSQL archive table of contents is unexpectedly large.")
    descriptions = []
    for line in listing.decode("utf-8", "replace").splitlines():
        m = TOC_RE.match(line)
        if m:
            descriptions.append(m.group(1))
    if not descriptions:
        raise backup.BackupError("pg_restore returned an empty or invalid archive TOC.")

    def count(kind: str) -> int:
        return sum(bool(re.match(r"^" + re.escape(kind) + r"\s+", desc)) for desc in descriptions)

    # Avoid treating TABLE DATA as a TABLE definition.
    tables = sum(bool(re.match(r"^TABLE\s+(?:public|private)\s+", desc)) for desc in descriptions)
    data = sum(bool(re.match(r"^TABLE DATA\s+(?:public|private)\s+", desc)) for desc in descriptions)
    if tables < 1:
        raise backup.BackupError("No application table definitions were found in the dump.")
    schemas = set()
    for desc in descriptions:
        m = re.match(r"^SCHEMA\s+-\s+(public|private)\b", desc)
        if m:
            schemas.add(m.group(1))
        elif re.match(r"^(?:TABLE|TABLE DATA|FUNCTION|SEQUENCE|VIEW)\s+(public|private)\s", desc):
            schemas.add(desc.split()[1 if not desc.startswith("TABLE DATA") else 2])
    return {
        "toc_entries": len(descriptions),
        "tables": tables,
        "table_data": data,
        "functions": count("FUNCTION"),
        "policies": count("POLICY"),
        "triggers": count("TRIGGER"),
        "foreign_keys": count("FK CONSTRAINT"),
        "schemas_seen": sorted(schemas),
        "has_managed_auth": any(re.match(r"^(?:SCHEMA|TABLE|TABLE DATA)\s+(?:-|auth)\s+auth(?:\s|$)", d) for d in descriptions),
    }


def audit_schema_sql(sql: bytes) -> dict:
    if not sql or len(sql) > MAX_SCHEMA_SQL_BYTES:
        raise backup.BackupError("Rendered schema SQL is missing or too large to inspect safely.")
    # Inspect locally in memory. Do not print any SQL, data, emails or tokens.
    # These patterns identify prerequisites, not proofs of successful restoration.
    return {
        "auth_user_fk_reference": bool(re.search(rb"\bREFERENCES\s+(?:ONLY\s+)?(?:\"auth\"|auth)\.(?:\"users\"|users)\b", sql, re.I)),
        "auth_helper_reference": bool(re.search(rb"\b(?:auth\.|\"auth\"\.)\s*(?:uid|jwt|role)\s*\(", sql, re.I)),
        "storage_reference": bool(re.search(rb"\b(?:storage\.|\"storage\"\.)", sql, re.I)),
        "extension_reference": bool(re.search(rb"\bCREATE\s+EXTENSION\b|(?:extensions\.)", sql, re.I)),
        "role_reference": bool(re.search(rb"\b(?:TO|SET ROLE)\s+(?:authenticated|anon|service_role)\b", sql, re.I)),
    }


def do_preflight(archive: Path, pg_bin: Path) -> dict:
    if not archive.is_file() or archive.suffix.lower() != ".dzoftbak":
        raise backup.BackupError("Supply an existing encrypted DZOFT .dzoftbak file.")
    restore_binary = native.binary_path(pg_bin.expanduser().resolve(), "pg_restore")
    if archive.stat().st_size > backup.MAX_ARCHIVE_BYTES + 128:
        raise backup.BackupError("Encrypted archive exceeds the supported verification limit.")
    passphrase = getpass.getpass("DZOFT DATABASE backup encryption passphrase (not stored): ")
    plain, manifest = backup.verified_archive(archive.read_bytes(), passphrase)
    if "database/application.dump" not in manifest["files"]:
        raise backup.BackupError(
            "This preflight supports native PostgreSQL custom-format backups only, "
            "not Supabase CLI split-SQL archives."
        )
    with zipfile.ZipFile(io.BytesIO(plain)) as contents:
        blob = contents.read("database/application.dump")
    if not blob.startswith(b"PGDMP"):
        raise backup.BackupError("Not a native PostgreSQL custom-format dump.")

    # pg_restore's list and SQL-output modes do not connect to PostgreSQL.
    toc = audit_toc(run_offline(restore_binary, "list", blob))
    checks = audit_schema_sql(run_offline(restore_binary, "schema", blob))
    run_offline(restore_binary, "render", blob)

    storage = manifest["storage"]["status"]
    print("PASS: encrypted DZOFT backup decrypted; archive CRC and SHA-256 verified.")
    print("PASS: pg_restore TOC, schema SQL and full SQL render succeeded OFFLINE.")
    print("Archive: native PostgreSQL custom | Source project:", backup.PROJECT_REF)
    print("TOC entries:", toc["toc_entries"])
    print("Application tables:", toc["tables"], "| Table-data entries:", toc["table_data"])
    print("Functions:", toc["functions"], "| Policies:", toc["policies"],
          "| Foreign keys:", toc["foreign_keys"])
    print("Application schemas identified:", ", ".join(toc["schemas_seen"]) or "none")
    print("Private client-files Storage:", storage)
    if storage == "skipped_by_operator":
        print("WARNING: Storage was intentionally omitted; this is a partial application backup.")
    print("Managed Supabase Auth schema contained:", "YES (unexpected)" if toc["has_managed_auth"] else "NO")
    if checks["auth_user_fk_reference"]:
        print("BLOCKER: application schema includes foreign keys to managed auth.users.")
    if checks["auth_helper_reference"]:
        print("DEPENDENCY: application logic uses Supabase Auth helper functions.")
    if checks["storage_reference"]:
        print("DEPENDENCY: schema SQL references Supabase-managed Storage.")
    if checks["extension_reference"]:
        print("DEPENDENCY: extension functions / extension installation may be needed.")
    if checks["role_reference"]:
        print("DEPENDENCY: original Supabase roles/grants require separate review.")
    print("WARNING: This offline audit is not a PostgreSQL restore and does not test accounts or RLS.")
    print("STOP: full disaster recovery remains NOT VERIFIED. No database connection or SQL execution occurred.")
    return {"toc": toc, "schema_checks": checks, "storage_status": storage}


def main() -> int:
    parser = argparse.ArgumentParser(description="Offline preflight for DZOFT encrypted PostgreSQL backup")
    parser.add_argument("--archive", required=True, type=Path, help="Existing encrypted .dzoftbak file")
    parser.add_argument("--pg-bin", required=True, type=Path, help="Local PostgreSQL 18 bin directory")
    args = parser.parse_args()
    try:
        do_preflight(args.archive.expanduser().resolve(), args.pg_bin)
        return 0
    except (backup.BackupError, OSError, ValueError, subprocess.TimeoutExpired) as exc:
        if isinstance(exc, subprocess.TimeoutExpired):
            print("ERROR: Offline pg_restore operation timed out. No SQL was executed.", file=sys.stderr)
        else:
            print("ERROR:", str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
