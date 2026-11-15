#!/usr/bin/env python3
"""Synthetic-only tests of DZOFT Auth recovery inventory. No live user data."""
from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import backup_dzoft as backup
import backup_dzoft_auth as auth

PASSWORD = "synthetic-not-real-backup-passphrase-2026"
DBPASSWORD = "synthetic-not-real-postgres-password"
HOST = "aws-1-eu-west-3.pooler.supabase.com"
USER = "postgres." + backup.PROJECT_REF


def specimen() -> dict:
    return {
        "format": auth.FORMAT,
        "source_project_ref": backup.PROJECT_REF,
        "captured_at_utc": "2026-11-15T15:00:00Z",
        "active_user_count": 2,
        "accounts": [
            {
                "source_user_id": "11111111-1111-4111-8111-111111111111",
                "email": "owner@example.invalid",
                "email_confirmed": True, "owner_claim": True,
                "providers": ["email"], "verified_factor_types": ["totp"],
                "registered_passkeys": 1, "client_refs": 0,
                "lead_refs": 0, "notification_settings_refs": 1
            },
            {
                "source_user_id": "22222222-2222-4222-8222-222222222222",
                "email": "client@example.invalid",
                "email_confirmed": True, "owner_claim": False,
                "providers": ["email"], "verified_factor_types": [],
                "registered_passkeys": 0, "client_refs": 1,
                "lead_refs": 0, "notification_settings_refs": 0
            }
        ]
    }


class AuthRecoveryTests(unittest.TestCase):
    def test_only_readonly_metadata_columns_are_exported(self):
        q = auth.AUTH_INVENTORY_QUERY.lower()
        for forbidden in ("encrypted_password", "raw_user_meta_data", "identity_data",
                          "secret", "token", "public_key", "private_key", "password_hash",
                          "insert into", "update auth.", "delete from", "drop table", "copy "):
            self.assertNotIn(forbidden, q)
        for required in ("auth.users", "auth.identities", "auth.mfa_factors",
                         "auth.webauthn_credentials", "public.clients", "public.leads",
                         "private.notification_settings", "raw_app_meta_data",
                         "dzoft_owner"):
            self.assertIn(required, q)

    def test_roundtrip_auth_and_tamper_detection(self):
        plain = json.dumps(specimen()).encode()
        obj = auth.validate_inventory(plain)
        self.assertEqual(obj["active_user_count"], 2)
        blob = auth.seal_inventory(plain, PASSWORD)
        self.assertTrue(blob.startswith(auth.MAGIC))
        self.assertNotIn(b"owner@example.invalid", blob)
        self.assertEqual(auth.verify_inventory(blob, PASSWORD)["active_user_count"], 2)
        with self.assertRaises(backup.BackupError):
            auth.verify_inventory(blob, "wrong-passphrase")
        altered = blob[:-1] + bytes([blob[-1] ^ 1])
        with self.assertRaises(backup.BackupError):
            auth.verify_inventory(altered, PASSWORD)

    def test_rejects_unexpected_secrets_roles_duplicates_and_invalid_data(self):
        data = specimen()
        bad = json.loads(json.dumps(data))
        bad["accounts"][0]["encrypted_password"] = "must-never-export"
        with self.assertRaisesRegex(backup.BackupError, "Unexpected fields"):
            auth.validate_inventory(json.dumps(bad).encode())
        bad = json.loads(json.dumps(data))
        bad["accounts"][1]["source_user_id"] = bad["accounts"][0]["source_user_id"]
        with self.assertRaisesRegex(backup.BackupError, "Duplicate"):
            auth.validate_inventory(json.dumps(bad).encode())
        bad = json.loads(json.dumps(data))
        bad["accounts"][1]["owner_claim"] = True
        with self.assertRaisesRegex(backup.BackupError, "one DZOFT owner"):
            auth.validate_inventory(json.dumps(bad).encode())
        bad = json.loads(json.dumps(data))
        bad["active_user_count"] = 3
        with self.assertRaisesRegex(backup.BackupError, "count"):
            auth.validate_inventory(json.dumps(bad).encode())
        bad = json.loads(json.dumps(data))
        bad["accounts"][0]["registered_passkeys"] = -1
        with self.assertRaisesRegex(backup.BackupError, "count"):
            auth.validate_inventory(json.dumps(bad).encode())
        bad = json.loads(json.dumps(data))
        bad["source_project_ref"] = "another-project"
        with self.assertRaisesRegex(backup.BackupError, "match DZOFT"):
            auth.validate_inventory(json.dumps(bad).encode())

    def test_fake_postgres_capture_encrypt_verify_and_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            pg_bin = directory / "pg-bin"
            pg_bin.mkdir()
            fake = pg_bin / "psql"
            fake.write_text(textwrap.dedent("""\
                #!/usr/bin/env python3
                import os,sys
                if os.getenv("PGHOST") != "aws-1-eu-west-3.pooler.supabase.com":
                    sys.exit(41)
                if os.getenv("PGUSER") != "postgres.rzghbvmszbjlqkdjzpxc":
                    sys.exit(42)
                if os.getenv("PGPASSWORD") != "synthetic-not-real-postgres-password":
                    sys.exit(43)
                if os.getenv("FAIL_QUERY") == "1": sys.exit(44)
                if "--command" not in sys.argv: sys.exit(45)
                query = sys.argv[sys.argv.index("--command")+1]
                if "auth.users" not in query or "drop table" in query.lower():
                    sys.exit(46)
                print(os.environ["FAKE_AUTH_JSON"])
            """), encoding="utf8")
            fake.chmod(0o700)
            env = dict(os.environ, FAKE_AUTH_JSON=json.dumps(specimen()))
            target = directory / "encrypted"
            command = [sys.executable, str(ROOT / "tools" / "backup_dzoft_auth.py"),
                       "capture", "--host", HOST, "--user", USER,
                       "--pg-bin", str(pg_bin), "--destination", str(target)]
            result = subprocess.run(command, env=env, text=True,
                                    input=DBPASSWORD+"\n"+PASSWORD+"\n"+PASSWORD+"\n",
                                    capture_output=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            self.assertNotIn("owner@example.invalid", result.stdout+result.stderr)
            self.assertFalse(list(target.glob("*.json")))
            self.assertFalse(list(target.glob("*.sql")))
            outputs = list(target.glob("*.dzoftauth"))
            self.assertEqual(len(outputs), 1)
            check = subprocess.run(
                [sys.executable, str(ROOT / "tools" / "backup_dzoft_auth.py"),
                 "verify", str(outputs[0])],
                text=True, input=PASSWORD+"\n", capture_output=True, timeout=30
            )
            self.assertEqual(check.returncode, 0, check.stderr+check.stdout)
            self.assertIn("PASS", check.stdout)
            self.assertNotIn("owner@example.invalid", check.stdout+check.stderr)

            bad_env = dict(env, FAIL_QUERY="1")
            failing = directory / "failed"
            error = subprocess.run([*command[:-1], str(failing)], env=bad_env,
                                   text=True, input=DBPASSWORD+"\n",
                                   capture_output=True, timeout=30)
            self.assertNotEqual(error.returncode, 0)
            self.assertEqual(list(failing.glob("*.dzoftauth")), [])
            self.assertNotIn(DBPASSWORD, error.stdout+error.stderr)

    def test_new_inventory_is_not_confused_with_database_backup(self):
        plain = json.dumps(specimen()).encode()
        auth_blob = auth.seal_inventory(plain, PASSWORD)
        with self.assertRaises(backup.BackupError):
            backup.verified_archive(auth_blob, PASSWORD)


if __name__ == "__main__":
    unittest.main()
