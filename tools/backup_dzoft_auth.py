#!/usr/bin/env python3
"""DZOFT Auth recovery inventory — encrypted, read-only, never restores accounts.

Captures minimal identifiers needed to re-associate application records with
verified, newly provisioned Supabase users after a disaster. DOES NOT capture
password hashes, passkeys, TOTP secrets, tokens or session credentials.

Run on the owner's encrypted computer, not on GitHub Actions.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import getpass
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import uuid

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

import backup_dzoft as backup
import backup_dzoft_native as native

MAGIC = b"DZOFTAUTH1"
FORMAT = "DZOFT Auth recovery ledger v1"
MAX_INVENTORY_BYTES = 8 * 1024 * 1024
MAX_ACCOUNT_COUNT = 5000

# Deliberate field allowlist. Never SELECT auth.users.encrypted_password,
# raw_user_meta_data, credentials, factor secrets, token rows, or passkey keys.
# This single read-only query represents one MVCC snapshot.
AUTH_INVENTORY_QUERY = """
with accounts as (
  select u.id, jsonb_build_object(
    'source_user_id', u.id::text,
    'email', u.email,
    'email_confirmed', (u.email_confirmed_at is not null),
    'owner_claim', (coalesce(u.raw_app_meta_data ->> 'dzoft_owner', '') = 'true'),
    'providers', (
      select coalesce(jsonb_agg(distinct i.provider), '[]'::jsonb)
      from auth.identities i where i.user_id = u.id
    ),
    'verified_factor_types', (
      select coalesce(jsonb_agg(distinct f.factor_type::text), '[]'::jsonb)
      from auth.mfa_factors f
      where f.user_id = u.id and f.status = 'verified'
    ),
    'registered_passkeys', (
      select count(*) from auth.webauthn_credentials w where w.user_id = u.id
    ),
    'client_refs', (
      select count(*) from public.clients c where c.user_id = u.id
    ),
    'lead_refs', (
      select count(*) from public.leads l where l.user_id = u.id
    ),
    'notification_settings_refs', (
      select count(*) from private.notification_settings n where n.owner_user_id = u.id
    )
  ) as recovery_record
  from auth.users u
  where u.deleted_at is null
)
select jsonb_build_object(
  'format', 'DZOFT Auth recovery ledger v1',
  'source_project_ref', 'rzghbvmszbjlqkdjzpxc',
  'captured_at_utc', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'active_user_count', (select count(*) from accounts),
  'accounts', coalesce((select jsonb_agg(recovery_record order by id) from accounts), '[]'::jsonb)
)::text;
"""

TOP_FIELDS = {"format", "source_project_ref", "captured_at_utc", "active_user_count", "accounts"}
ACCOUNT_FIELDS = {
    "source_user_id", "email", "email_confirmed", "owner_claim",
    "providers", "verified_factor_types", "registered_passkeys",
    "client_refs", "lead_refs", "notification_settings_refs"
}
COUNT_FIELDS = ("registered_passkeys", "client_refs", "lead_refs", "notification_settings_refs")


def validate_inventory(payload: bytes) -> dict:
    """Validate allowlisted recovery metadata without printing account identities."""
    if not payload or len(payload) > MAX_INVENTORY_BYTES:
        raise backup.BackupError("Auth inventory is empty or exceeds its size limit.")
    try:
        obj = json.loads(payload)
    except (UnicodeDecodeError, ValueError) as exc:
        raise backup.BackupError("Invalid Auth inventory JSON.") from exc
    if not isinstance(obj, dict) or set(obj) != TOP_FIELDS:
        raise backup.BackupError("Unexpected Auth inventory format or fields.")
    if obj["format"] != FORMAT or obj["source_project_ref"] != backup.PROJECT_REF:
        raise backup.BackupError("Auth recovery inventory does not match DZOFT.")
    date = obj["captured_at_utc"]
    if not isinstance(date, str):
        raise backup.BackupError("Missing Auth inventory timestamp.")
    try:
        datetime.fromisoformat(date.replace("Z", "+00:00"))
    except ValueError as exc:
        raise backup.BackupError("Invalid Auth inventory timestamp.") from exc
    accounts = obj["accounts"]
    if not isinstance(accounts, list) or not (1 <= len(accounts) <= MAX_ACCOUNT_COUNT):
        raise backup.BackupError("Missing or excessive Auth accounts.")
    if type(obj["active_user_count"]) is not int or obj["active_user_count"] != len(accounts):
        raise backup.BackupError("Auth account-count mismatch.")
    seen_ids = set()
    owners = 0
    for a in accounts:
        if not isinstance(a, dict) or set(a) != ACCOUNT_FIELDS:
            raise backup.BackupError("Unexpected fields in Auth account record.")
        try:
            identifier = str(uuid.UUID(a["source_user_id"]))
        except (ValueError, TypeError, KeyError, AttributeError) as exc:
            raise backup.BackupError("Invalid source Auth user identifier.") from exc
        if identifier in seen_ids or identifier != a["source_user_id"]:
            raise backup.BackupError("Duplicate or noncanonical source Auth user identifier.")
        seen_ids.add(identifier)
        email = a["email"]
        if email is not None and (not isinstance(email, str) or not (3 <= len(email) <= 254) or
                                  "@" not in email or "\n" in email or "\r" in email):
            raise backup.BackupError("Invalid Auth email reference.")
        if type(a["email_confirmed"]) is not bool or type(a["owner_claim"]) is not bool:
            raise backup.BackupError("Invalid Auth role or confirmation marker.")
        owners += int(a["owner_claim"])
        for field in ("providers", "verified_factor_types"):
            value = a[field]
            if (not isinstance(value, list) or len(value) > 30 or
                any(not isinstance(v, str) or not 1 <= len(v) <= 64 for v in value)):
                raise backup.BackupError("Invalid authentication method inventory.")
        for field in COUNT_FIELDS:
            v = a[field]
            if type(v) is not int or v < 0 or v > 10_000_000:
                raise backup.BackupError("Invalid Auth-to-application reference count.")
    # Owner restoration must never be inferred from an ambiguous ledger.
    if owners != 1:
        raise backup.BackupError("Expected one DZOFT owner identity; review roles before backing up.")
    return obj


def seal_inventory(payload: bytes, passphrase: str) -> bytes:
    salt = secrets.token_bytes(backup.SALT_SIZE)
    nonce = secrets.token_bytes(backup.NONCE_SIZE)
    encrypted = AESGCM(backup.key_for(passphrase, salt)).encrypt(nonce, payload, MAGIC)
    return MAGIC + salt + nonce + encrypted


def verify_inventory(archive: bytes, passphrase: str) -> dict:
    offset = len(MAGIC)
    if (len(archive) <= offset + backup.SALT_SIZE + backup.NONCE_SIZE + 16 or
            len(archive) > MAX_INVENTORY_BYTES + 1024 or not archive.startswith(MAGIC)):
        raise backup.BackupError("Not a DZOFT encrypted Auth recovery inventory.")
    salt = archive[offset:offset + backup.SALT_SIZE]
    nonce = archive[offset + backup.SALT_SIZE:offset + backup.SALT_SIZE + backup.NONCE_SIZE]
    try:
        plain = AESGCM(backup.key_for(passphrase, salt)).decrypt(
            nonce, archive[offset + backup.SALT_SIZE + backup.NONCE_SIZE:], MAGIC)
    except InvalidTag as exc:
        raise backup.BackupError("Wrong inventory passphrase or corrupted file.") from exc
    return validate_inventory(plain)


def capture(args: argparse.Namespace) -> None:
    host, user = native.checked_target(args.host, args.user, args.port)
    binary = native.binary_path(args.pg_bin.expanduser().resolve(), "psql")
    destination = backup.ensure_destination(args.destination)

    print("DZOFT Auth recovery: READ-ONLY inventory for project " + backup.PROJECT_REF)
    print("Exports only user IDs, email addresses, Auth method names and reference counts.")
    print("Passwords, password hashes, MFA secrets, passkeys and session tokens are EXCLUDED.")
    password = getpass.getpass("RD-Clients DATABASE password (not saved): ")
    if not password:
        raise backup.BackupError("Database password required.")
    env = dict(os.environ, PGHOST=host, PGPORT=str(args.port), PGUSER=user,
               PGDATABASE="postgres", PGPASSWORD=password,
               PGCONNECT_TIMEOUT="20",
               PGSSLMODE="verify-full" if args.ssl_root_cert else "require")
    del password
    if args.ssl_root_cert:
        certificate = args.ssl_root_cert.expanduser().resolve()
        if not certificate.is_file():
            raise backup.BackupError("Supabase SSL root certificate does not exist.")
        env["PGSSLROOTCERT"] = str(certificate)
    else:
        print("NOTICE: TLS encryption is required; verify-full needs your Supabase CA certificate.")
    # Return only query output in process memory, not into a plaintext file.
    result = subprocess.run(
        [binary, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1",
         "--dbname=postgres", "--command", AUTH_INVENTORY_QUERY],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, check=False
    )
    if result.returncode:
        raise backup.BackupError(
            "Auth inventory query failed. Check DB permissions, credentials and connectivity. "
            "No inventory was saved.")
    payload = result.stdout.strip()
    inventory = validate_inventory(payload)
    print("Accounts inventoried:", inventory["active_user_count"])
    print("Verified owner identity count: 1")
    print("Creating an encrypted recovery inventory — no plaintext file on disk.")
    passphrase = backup.password_prompt(confirm=True)
    encrypted = seal_inventory(payload, passphrase)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%SZ")
    target = destination / ("dzoft-auth-" + stamp + "-" + secrets.token_hex(3) + ".dzoftauth")
    with target.open("xb") as out:
        out.write(encrypted)
    try:
        check = verify_inventory(target.read_bytes(), passphrase)
        if check["active_user_count"] != inventory["active_user_count"]:
            raise backup.BackupError("Written Auth recovery inventory does not match the source.")
    except Exception:
        target.unlink(missing_ok=True)
        raise
    print("PASS: encrypted Auth recovery inventory verified at:", target)
    print("IMPORTANT: This inventory is NOT a credential backup. Re-enrollment is required after disaster.")
    print("Copy only the encrypted .dzoftauth file to your private Google Drive folder.")


def verify(args: argparse.Namespace) -> None:
    passphrase = getpass.getpass("Auth inventory encryption passphrase (not saved): ")
    obj = verify_inventory(args.archive.read_bytes(), passphrase)
    print("PASS: Auth recovery inventory decrypts and validates for RD-Clients.")
    print("Accounts:", obj["active_user_count"], "| DZOFT owner identities: 1")
    print("Sensitive account details are intentionally not displayed.")
    print("This is identity mapping metadata, not passwords, passkeys or a restoration test.")


def main() -> int:
    parser = argparse.ArgumentParser(description="DZOFT encrypted Auth recovery inventory")
    sub = parser.add_subparsers(dest="command", required=True)
    cap = sub.add_parser("capture", help="Read minimal Supabase Auth metadata and encrypt it")
    cap.add_argument("--host", required=True)
    cap.add_argument("--user", required=True)
    cap.add_argument("--port", type=int, default=5432)
    cap.add_argument("--pg-bin", type=Path, required=True)
    cap.add_argument("--destination", type=Path, default=Path.home() / "DZOFT-Backups")
    cap.add_argument("--ssl-root-cert", type=Path)
    check = sub.add_parser("verify", help="Verify encrypted file without disclosing user identities")
    check.add_argument("archive", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "capture":
            capture(args)
        else:
            verify(args)
        return 0
    except (backup.BackupError, ValueError, OSError) as exc:
        print("ERROR:", str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
