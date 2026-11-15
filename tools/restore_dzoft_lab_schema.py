#!/usr/bin/env python3
"""Transaction-protected DZOFT schema PRE-DATA restoration into the fixed local lab.

No production connectivity. No customer rows, Auth identities, or plaintext
SQL/dumps are written to disk. PostgreSQL restores execute code from the dump:
only run against the user's own trusted DZOFT archive, never an unknown archive.
"""
from __future__ import annotations

import argparse
import getpass
import io
import os
from pathlib import Path
import subprocess
import sys
import zipfile

import backup_dzoft as backup
import backup_dzoft_native as native
from preflight_dzoft_restore import audit_toc, run_offline

HOST, PORT, USER, DATABASE = "127.0.0.1", "55439", "dzoft_lab_admin", "dzoft_restore_test"
EXPECTED_DATA_DIR = Path.home() / "DZOFT-Recovery-Lab" / "pgdata"
CONNECT = ["--host=" + HOST, "--port=" + PORT, "--username=" + USER, "--dbname=" + DATABASE]
CHECK = """
SELECT current_database(), host(inet_server_addr()), inet_server_port(),
       current_setting('data_directory'), current_setting('listen_addresses'),
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ('public','private') AND c.relkind IN ('r','p')),
       (SELECT count(*) FROM pg_extension
        WHERE extname IN ('pgcrypto','uuid-ossp')
        AND extnamespace='extensions'::regnamespace),
       (SELECT count(*) FROM pg_roles
        WHERE rolname IN ('anon','authenticated','service_role')
        AND NOT rolcanlogin AND NOT rolbypassrls);
"""


def pg_environment(password: str) -> dict[str, str]:
    env = {k: v for k, v in os.environ.items() if not k.upper().startswith("PG")}
    env.update({"PGPASSWORD": password, "PGCONNECT_TIMEOUT": "10", "PGSSLMODE": "disable"})
    return env


def inspect(psql: str, env: dict[str, str], *, require_empty: bool) -> int:
    p = subprocess.run([psql, "-X", "-A", "-t", "-F", "|", "-v", "ON_ERROR_STOP=1",
                        *CONNECT, "-c", CHECK], stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                       env=env, timeout=30, check=False)
    if p.returncode:
        raise backup.BackupError("Local lab inspection failed; no restore attempted.")
    lines = [l.strip() for l in p.stdout.decode("utf-8", "replace").splitlines() if l.strip()]
    if len(lines) != 1 or len(lines[0].split("|")) != 8:
        raise backup.BackupError("Unexpected local lab identity result.")
    db, addr, port, directory, listen, tables, exts, roles = lines[0].split("|")
    canon = lambda s: s.replace("\\", "/").rstrip("/").casefold()
    if (db != DATABASE or addr != HOST or port != PORT or
            canon(directory) != canon(str(EXPECTED_DATA_DIR)) or listen != HOST):
        raise backup.BackupError("STOP: wrong local lab database, directory or listening address.")
    if exts != "2" or roles != "3":
        raise backup.BackupError("STOP: required extensions or safe NOLOGIN roles are missing.")
    try:
        number = int(tables)
    except ValueError as exc:
        raise backup.BackupError("Invalid application table count.") from exc
    if require_empty and number != 0:
        raise backup.BackupError("STOP: local recovery database is not empty; refusing to overwrite.")
    return number


def pg_restore_schema(binary: str, archive: bytes, env: dict[str, str]) -> tuple[bool, str]:
    # A single transaction makes every database change rollback on error.
    # IF EXISTS cleaning handles the public schema present in template0;
    # only safe because target and absence of existing app tables are checked.
    args = [binary, *CONNECT, "--section=pre-data", "--single-transaction",
            "--exit-on-error", "--clean", "--if-exists", "--no-owner",
            "--no-privileges", "--no-tablespaces"]
    p = subprocess.run(args, input=archive, stdout=subprocess.DEVNULL,
                       stderr=subprocess.PIPE, env=env, check=False, timeout=240)
    if p.returncode == 0:
        return True, ""
    error = p.stderr.lower()
    if b'schema "auth" does not exist' in error:
        return False, "Supabase-managed auth schema is absent"
    if b'schema "storage" does not exist' in error:
        return False, "Supabase-managed storage schema is absent"
    if b'does not exist' in error:
        return False, "A required external database dependency is absent"
    if b'already exists' in error:
        return False, "A local schema or database object already exists"
    return False, "PostgreSQL rejected a schema object or dependency"


def run(archive: Path, pg_bin: Path) -> None:
    psql = native.binary_path(pg_bin.resolve(), "psql")
    restore = native.binary_path(pg_bin.resolve(), "pg_restore")
    if not EXPECTED_DATA_DIR.joinpath("PG_VERSION").is_file():
        raise backup.BackupError("Expected local DZOFT lab is not initialized.")
    if not archive.is_file() or archive.suffix.lower() != ".dzoftbak":
        raise backup.BackupError("Provide an existing encrypted DZOFT database backup.")
    if archive.stat().st_size > backup.MAX_ARCHIVE_BYTES + 128:
        raise backup.BackupError("Encrypted archive exceeds supported size limits.")
    print("LOCAL SCHEMA ONLY:", HOST + ":" + PORT + "/" + DATABASE)
    print("No client rows, Auth accounts, production connections or plaintext files.")
    lab_password = getpass.getpass("Local Recovery Lab password (not saved): ")
    if not lab_password:
        raise backup.BackupError("Local lab password is required.")
    env = pg_environment(lab_password)
    del lab_password
    inspect(psql, env, require_empty=True)
    print("PASS: exact localhost lab, restricted roles, extensions and empty tables.")
    archive_password = getpass.getpass("DATABASE ARCHIVE passphrase (not saved): ")
    plain, manifest = backup.verified_archive(archive.read_bytes(), archive_password)
    del archive_password
    if "database/application.dump" not in manifest["files"]:
        raise backup.BackupError("Only PostgreSQL native custom-format backups are supported.")
    with zipfile.ZipFile(io.BytesIO(plain)) as z:
        dump = z.read("database/application.dump")
    del plain
    if not dump.startswith(b"PGDMP"):
        raise backup.BackupError("Unexpected PostgreSQL archive header.")
    toc = audit_toc(run_offline(restore, "list", dump))
    if toc["has_managed_auth"]:
        raise backup.BackupError("Managed Auth schema unexpectedly included in backup.")
    print("Attempting transaction-protected PRE-DATA schema restore for", toc["tables"], "tables...")
    ok, explanation = pg_restore_schema(restore, dump, env)
    del dump
    if not ok:
        print("BLOCKED:", explanation)
        print("PRE-DATA restore used a single transaction, so failed SQL is rolled back.")
        print("No customer data was imported. Do not create fake Auth accounts or weaken RLS.")
        raise backup.BackupError("Schema restore blocked; further dependency review required.")
    restored = inspect(psql, env, require_empty=False)
    print("Schema objects committed on LOCAL LAB. Restored tables:", restored)
    if restored != toc["tables"]:
        raise backup.BackupError("Post-restore table count differs from backup; investigation required.")
    print("PASS: Local PRE-DATA table definitions restored.")
    print("PENDING: rows, FK constraints, security policies, grants, Auth and full recovery.")


def main() -> int:
    ap = argparse.ArgumentParser(description="DZOFT pinned localhost schema-only restore stage")
    ap.add_argument("--archive", required=True, type=Path)
    ap.add_argument("--pg-bin", required=True, type=Path)
    args = ap.parse_args()
    try:
        run(args.archive.expanduser().resolve(), args.pg_bin)
        return 0
    except subprocess.TimeoutExpired:
        print("ERROR: local lab operation timed out; inspect the lab before retry.", file=sys.stderr)
    except (backup.BackupError, OSError, ValueError) as exc:
        print("ERROR:", str(exc), file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
