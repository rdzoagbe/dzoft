#!/usr/bin/env python3
"""DZOFT offline recovery evidence gate.

Checks privately held ENCRYPTED backup, independent copy and Auth mapping.
Does NOT contact any database, restore records, export data, or mark recovery
verified. All secrets are entered locally and never printed.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone, timedelta
import getpass
import hashlib
import io
from pathlib import Path
import re
import sys
import zipfile

import backup_dzoft as backup
import backup_dzoft_auth as auth
import backup_dzoft_native as native
import preflight_dzoft_restore as preflight

MAX_CIPHER_BYTES = backup.MAX_ARCHIVE_BYTES + 512

class EvidenceFailure(RuntimeError):
    pass

def read_encrypted(path: Path, suffix: str, max_bytes: int) -> bytes:
    # Only the owner's local trusted, encrypted machine should hold these files.
    if path.is_symlink() or not path.is_file() or path.suffix.lower() != suffix:
        raise EvidenceFailure("Encrypted input missing, symbolic-linked or wrong extension.")
    if path.stat().st_size <= 0 or path.stat().st_size > max_bytes:
        raise EvidenceFailure("Encrypted input exceeds size limits or is empty.")
    return path.read_bytes()

def parse_utc(utc_string: str) -> datetime:
    if not isinstance(utc_string, str):
        raise EvidenceFailure("Encrypted inventory has no valid capture timestamp.")
    try:
        captured = datetime.fromisoformat(utc_string.replace("Z", "+00:00"))
    except (ValueError, OverflowError) as exc:
        raise EvidenceFailure("Encrypted inventory timestamp invalid.") from exc
    if captured.utcoffset() is None:
        raise EvidenceFailure("Encrypted inventory timestamp must have UTC offset.")
    return captured.astimezone(timezone.utc)

def age_check(captured: datetime, max_age_hours: int, now: datetime) -> bool:
    if captured > now + timedelta(minutes=5):
        raise EvidenceFailure("Encrypted backup capture time is in the future.")
    return now - captured <= timedelta(hours=max_age_hours)

def backup_evidence(ciphertext: bytes, passphrase: str, *, expected_storage: int,
                    max_age_hours: int, now: datetime) -> tuple[dict, bytes]:
    # The project's verified_archive reads and hashes every ZIP member.
    try:
        plain, manifest = backup.verified_archive(ciphertext, passphrase)
    except (backup.BackupError, OSError, ValueError, RuntimeError) as exc:
        raise EvidenceFailure("Encrypted application archive is invalid or cannot be decrypted.") from exc
    captured = parse_utc(manifest.get("captured_at_utc"))
    storage = manifest["storage"]
    files = manifest["files"]
    actual_storage = storage["files"]
    if actual_storage != expected_storage:
        raise EvidenceFailure("Backup Storage object count does not match a fresh live inventory.")
    if expected_storage > 0 and storage["status"] != "exported":
        raise EvidenceFailure("Storage contains objects but this backup did not export them.")
    if expected_storage == 0 and storage["status"] not in ("verified_empty_by_cli", "verified_empty_by_sql"):
        raise EvidenceFailure("Empty Storage has not been independently verified.")
    recent = age_check(captured, max_age_hours, now)
    dump_type = "native" if "database/application.dump" in files else "split"
    return ({
        "storage_count": actual_storage, "storage_status": storage["status"],
        "format": dump_type, "captured_at_utc": captured.isoformat(),
        "recent": recent, "manifest_file_count": len(files)
    }, plain)

def offsite_evidence(original: bytes, offsite: bytes, password: str) -> None:
    if hashlib.sha256(original).digest() != hashlib.sha256(offsite).digest():
        raise EvidenceFailure("Independent encrypted off-site copy differs from the source.")
    try:
        backup.verified_archive(offsite, password)
    except (backup.BackupError, OSError, ValueError, RuntimeError) as exc:
        raise EvidenceFailure("Independent encrypted copy failed decryption/integrity checks.") from exc

def auth_evidence(ciphertext: bytes, password: str, *, expected_users: int,
                  max_age_hours: int, now: datetime) -> dict:
    try:
        manifest = auth.verify_inventory(ciphertext, password)
    except (backup.BackupError, ValueError, RuntimeError) as exc:
        raise EvidenceFailure("Encrypted Auth mapping ledger is invalid or cannot be decrypted.") from exc
    captured = parse_utc(manifest["captured_at_utc"])
    if manifest["active_user_count"] != expected_users:
        raise EvidenceFailure("Auth mapping count differs from the fresh live inventory.")
    return {"users": expected_users, "recent": age_check(captured,max_age_hours,now)}

def pg_evidence(zip_bytes: bytes, pg_bin: Path) -> dict:
    try:
        binary = native.binary_path(pg_bin.expanduser().resolve(), "pg_restore")
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as z:
            if "database/application.dump" not in z.namelist():
                return {"evaluated": False, "reason":"split SQL requires a separate isolated restore and SQL review"}
            dump = z.read("database/application.dump")
        table_of_contents = preflight.audit_toc(preflight.run_offline(binary, "list", dump))
        deps = preflight.audit_schema_sql(preflight.run_offline(binary, "schema", dump))
        preflight.run_offline(binary, "render", dump)
        return {"evaluated":True, "tables": table_of_contents["tables"],
                "table_data_entries":table_of_contents["table_data"],
                "functions":table_of_contents["functions"],
                "policies":table_of_contents["policies"],
                "auth_dependencies":deps["auth_user_fk_reference"] or deps["auth_helper_reference"]}
    except (backup.BackupError, OSError, ValueError, RuntimeError) as exc:
        raise EvidenceFailure("Offline PostgreSQL TOC or full SQL render failed.") from exc

def evaluate(*, archive_blob: bytes, archive_password: str,
             expected_storage_count: int, expected_auth_count: int,
             auth_blob: bytes|None, auth_password: str|None,
             offsite_blob: bytes|None, pg_bin: Path|None,
             max_age_hours: int, now: datetime) -> tuple[list[str], list[str]]:
    """Return safe, non-identifying PASS and BLOCKER reasons, never user data."""
    passed, blocked = [], []
    evidence, decrypted = backup_evidence(
        archive_blob, archive_password, expected_storage=expected_storage_count,
        max_age_hours=max_age_hours, now=now)
    passed.append("Authenticated database archive, file hashes and operator-supplied Storage inventory count.")
    if evidence["recent"]:
        passed.append("Database snapshot falls within the requested age window.")
    else:
        blocked.append("Database snapshot is older than requested freshness window.")
    if offsite_blob is None:
        blocked.append("Independent encrypted off-site copy not supplied/verified.")
    else:
        offsite_evidence(archive_blob, offsite_blob, archive_password)
        passed.append("Independent encrypted copy: identical SHA-256 and decrypted integrity.")
    if auth_blob is None:
        blocked.append("Separate encrypted Auth identity-mapping ledger not supplied.")
    elif not auth_password:
        blocked.append("Separate Auth ledger passphrase not supplied.")
    else:
        auth_state = auth_evidence(auth_blob,auth_password,expected_users=expected_auth_count,
                                   max_age_hours=max_age_hours,now=now)
        passed.append("Encrypted Auth mapping validated: account count + unique owner marker.")
        if not auth_state["recent"]:
            blocked.append("Auth mapping ledger is older than requested freshness window.")
    if pg_bin is None:
        blocked.append("Offline PostgreSQL dump SQL/TOC rendering was not attempted.")
    else:
        parsed = pg_evidence(decrypted,pg_bin)
        if not parsed["evaluated"]:
            blocked.append("CLI split-SQL archive not rendered by this native pg_restore preflight.")
        else:
            passed.append("Native PostgreSQL TOC, schema and full SQL render passed without DB connection.")
            if parsed["table_data_entries"] < 1:
                blocked.append("No application table-data entries in native archive.")
            if parsed["auth_dependencies"]:
                blocked.append("Supabase-managed Auth dependencies still require isolated target mapping.")
    blocked.append("No disposable environment restored and reconciled: full disaster recovery NOT VERIFIED.")
    return passed,blocked

def main(argv: list[str]|None=None) -> int:
    ap=argparse.ArgumentParser(description="DZOFT offline encrypted evidence check — NEVER a production restore")
    ap.add_argument("--archive",type=Path,required=True,help="Local encrypted .dzoftbak; no secrets on command line")
    ap.add_argument("--offsite-copy",type=Path,help="Independent encrypted copy downloaded from off-site storage")
    ap.add_argument("--auth-archive",type=Path,help="Separate encrypted Auth mapping (.dzoftauth)")
    ap.add_argument("--expected-storage-count",type=int,required=True,help="Fresh live Storage SQL count")
    ap.add_argument("--expected-auth-count",type=int,required=True,help="Fresh live managed Auth users count")
    ap.add_argument("--max-age-hours",type=int,default=72,help="Maximum age of each snapshot (default 72 h)")
    ap.add_argument("--pg-bin",type=Path,help="Optional local pg_restore binary directory, native dumps only")
    args=ap.parse_args(argv)
    if args.expected_storage_count<0 or args.expected_auth_count<1 or args.max_age_hours<1:
        ap.error("Expected counts must be valid and max-age-hours >= 1.")
    print("DZOFT OFFLINE BACKUP EVIDENCE CHECK — NOT A RESTORE")
    print("No Supabase, PostgreSQL database, cloud API or network request is made.")
    try:
        source=read_encrypted(args.archive,".dzoftbak",MAX_CIPHER_BYTES)
        if args.offsite_copy is not None and args.offsite_copy.is_file() and args.archive.samefile(args.offsite_copy):
            raise EvidenceFailure("Off-site copy must be a different file.")
        other=read_encrypted(args.offsite_copy,".dzoftbak",MAX_CIPHER_BYTES) if args.offsite_copy else None
        ledger=read_encrypted(args.auth_archive,".dzoftauth",auth.MAX_INVENTORY_BYTES+1024) if args.auth_archive else None
        pwd=getpass.getpass("Encrypted DATABASE archive passphrase (not stored): ")
        auth_pw=getpass.getpass("Encrypted AUTH ledger passphrase (not stored): ") if ledger else None
        if not pwd or (ledger is not None and not auth_pw):
            raise EvidenceFailure("Required private passphrase was not provided.")
        passed,pending=evaluate(
            archive_blob=source,archive_password=pwd,
            expected_storage_count=args.expected_storage_count,
            expected_auth_count=args.expected_auth_count,
            auth_blob=ledger,auth_password=auth_pw,offsite_blob=other,pg_bin=args.pg_bin,
            max_age_hours=args.max_age_hours,now=datetime.now(timezone.utc)
        )
        for item in passed: print("PASS:",item)
        for item in pending: print("PENDING:",item)
        print("FINAL: NOT RESTORE-VERIFIED. Never restore into production.")
        return 2 if pending else 0
    except EvidenceFailure as exc:
        print("BLOCKED:",str(exc),file=sys.stderr)
        print("FINAL: NOT RESTORE-VERIFIED; no SQL executed.",file=sys.stderr)
        return 2
    except (OSError, ValueError, EOFError, KeyboardInterrupt):
        print("BLOCKED: local input or offline tool unavailable; no SQL executed.",file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
