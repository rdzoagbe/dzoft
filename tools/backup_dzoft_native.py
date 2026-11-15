#!/usr/bin/env python3
"""DZOFT Windows native PostgreSQL backup, no Docker or Supabase CLI.

Reads only public/private app schemas from the explicitly selected RD-Clients
project. Writes one AES-GCM encrypted .dzoftbak, with no plaintext dump on disk.
This is NOT an Auth, complete Storage, roles, or disaster-recovery backup.
"""
from __future__ import annotations

import argparse
import getpass
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
from datetime import datetime, timezone

import backup_dzoft as backup

REF = backup.PROJECT_REF
DIRECT_HOST = f"db.{REF}.supabase.co"


def checked_target(host: str, user: str, port: int) -> tuple[str, str]:
    host = host.strip().lower().rstrip(".")
    user = user.strip()
    if not 1 <= port <= 65535:
        raise backup.BackupError("Invalid PostgreSQL port.")
    if host == DIRECT_HOST:
        if user != "postgres":
            raise backup.BackupError("Direct DZOFT connection must use database user 'postgres'.")
    elif re.fullmatch(r"[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pooler\.supabase\.com", host):
        if user != f"postgres.{REF}":
            raise backup.BackupError("Session pooler username must include the exact RD-Clients project ref.")
        if port != 5432:
            raise backup.BackupError("Use the session pooler on port 5432, never the transaction pooler.")
    else:
        raise backup.BackupError("Host is not the RD-Clients direct endpoint or a Supabase session pooler.")
    return host, user


def binary_path(folder: Path, command: str) -> str:
    name = command + (".exe" if os.name == "nt" else "")
    path = folder / name
    if not path.is_file():
        raise backup.BackupError(f"Missing {name} in the selected PostgreSQL bin directory.")
    return str(path)


def run_pg(binary: str, args: list[str], *, env: dict, stdin: bytes | None = None) -> bytes:
    # No credentials or connection string in process arguments, files or logs.
    proc = subprocess.run([binary, *args], input=stdin, stdout=subprocess.PIPE,
                          stderr=subprocess.PIPE, env=env, check=False)
    if proc.returncode:
        raise backup.BackupError(
            "PostgreSQL command failed. Check the host, project user, database password, "
            "SSL configuration and account privileges on your computer. "
            "No backup was marked successful."
        )
    return proc.stdout


def do_native(args: argparse.Namespace) -> None:
    host, user = checked_target(args.host, args.user, args.port)
    folder = args.pg_bin.expanduser().resolve()
    dump_binary = binary_path(folder, "pg_dump")
    restore_binary = binary_path(folder, "pg_restore")
    psql_binary = binary_path(folder, "psql")
    dest = backup.ensure_destination(args.destination)

    print(f"Target: RD-Clients ({REF}), PostgreSQL native export")
    print(f"Host: {host}; port: {args.port}; user: {user}")
    print("This script does not restore, migrate, modify or email any live client data.")
    print("No PostgreSQL dump is written to a plaintext file.")
    dbpassword = getpass.getpass("RD-Clients DATABASE password (never printed or stored): ")
    if not dbpassword:
        raise backup.BackupError("A database password is required.")
    env = dict(os.environ)
    env.update({
        "PGHOST": host, "PGPORT": str(args.port), "PGUSER": user,
        "PGDATABASE": "postgres", "PGPASSWORD": dbpassword,
        "PGCONNECT_TIMEOUT": "20", "PGSSLMODE": "verify-full" if args.ssl_root_cert else "require"
    })
    if args.ssl_root_cert:
        cert = args.ssl_root_cert.expanduser().resolve()
        if not cert.is_file():
            raise backup.BackupError("Supabase root certificate file was not found.")
        env["PGSSLROOTCERT"] = str(cert)
    else:
        print("NOTICE: Transport is encrypted (SSL required), but server certificate identity is not independently verified.")
        print("For stronger protection, download the Supabase CA certificate and use -PgSslRootCert.")
    del dbpassword

    psql = ["--no-psqlrc", "--no-align", "--tuples-only", "--quiet",
            "--set=ON_ERROR_STOP=1", "--dbname=postgres"]

    def storage_count() -> int:
        result = run_pg(psql_binary, psql + [
            "--command=select count(*) from storage.objects where bucket_id = 'client-files';"
        ], env=env).decode("ascii", "replace").strip()
        if not result.isdecimal():
            raise backup.BackupError("Could not verify the private client-files Storage count.")
        return int(result)

    run_pg(psql_binary, psql + ["--command=select current_database();"], env=env)
    before = None if args.skip_storage else storage_count()
    if before and not args.skip_storage:
        raise backup.BackupError(
            f"Private Storage contains {before} object(s). This Docker-free tool cannot "
            "download objects; use a separately tested Storage backup or explicitly "
            "choose -SkipStorage to make a PARTIAL database-only backup."
        )

    print("Exporting public + private application schemas in one consistent pg_dump snapshot...")
    blob = run_pg(dump_binary, [
        "--format=custom", "--no-owner", "--no-privileges",
        "--schema=public", "--schema=private", "--dbname=postgres"
    ], env=env)
    if not blob.startswith(b"PGDMP") or len(blob) < 100:
        raise backup.BackupError("The PostgreSQL custom-format backup is empty or invalid.")
    if len(blob) > backup.MAX_ARCHIVE_BYTES:
        raise backup.BackupError("Database exceeds the safe memory-based export limit.")
    # pg_restore only LISTS the archive; it never connects to or writes to a database.
    run_pg(restore_binary, ["--list"], env=env, stdin=blob)
    after = None if args.skip_storage else storage_count()
    if before != after:
        raise backup.BackupError("Storage inventory changed during export; retry the backup.")
    if after:
        raise backup.BackupError("Storage contains files. A database-only archive cannot claim a complete file backup.")

    storage = {"bucket": backup.BUCKET, "files": 0,
               "status": "skipped_by_operator" if args.skip_storage else "verified_empty_by_sql"}
    print("Storage status:", storage["status"])
    print("Managed Auth, roles and Supabase project settings are NOT included.")
    password = backup.password_prompt(confirm=True)
    zip_data = backup.build_zip({"database/application.dump": blob}, REF, storage)
    if len(zip_data) > backup.MAX_ARCHIVE_BYTES:
        raise backup.BackupError("Backup archive exceeded the safe memory limit.")
    encrypted = backup.seal(zip_data, password)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    target = dest / f"dzoft-{stamp}-{secrets.token_hex(3)}.dzoftbak"
    with target.open("xb") as f:
        f.write(encrypted)
    try:
        backup.verified_archive(target.read_bytes(), password)
    except Exception:
        target.unlink(missing_ok=True)
        raise
    print("PASS: encrypted and verified:", target)
    print("WARNING: application database exported; Auth credentials, roles and full recovery NOT tested.")
    if args.skip_storage:
        print("WARNING: Storage was skipped; this is explicitly a PARTIAL backup.")
    print("Next: verify an independently protected copy and perform an isolated restore drill.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Docker-free encrypted DZOFT PostgreSQL backup")
    parser.add_argument("--host", required=True, help="Exact Supabase direct or session pooler host")
    parser.add_argument("--user", required=True, help="postgres or postgres.<DZOFT project ref>")
    parser.add_argument("--port", type=int, default=5432)
    parser.add_argument("--pg-bin", type=Path, required=True, help="PostgreSQL 18 bin folder")
    parser.add_argument("--destination", type=Path, default=Path.home() / "DZOFT-Backups")
    parser.add_argument("--ssl-root-cert", type=Path, help="Supabase CA certificate for verify-full SSL")
    parser.add_argument("--skip-storage", action="store_true", help="Deliberately export database only")
    args = parser.parse_args()
    try:
        do_native(args)
        return 0
    except (backup.BackupError, OSError, ValueError) as exc:
        print("ERROR:", str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
