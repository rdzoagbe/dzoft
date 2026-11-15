#!/usr/bin/env python3
"""Fake PostgreSQL tests for the Docker-free DZOFT backup. No production access."""
from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import backup_dzoft as backup
import backup_dzoft_native as native

SECRET = "fake-db-password-never-real"
PASSWORD = "synthetic-archive-password-32"
HOST = "aws-0-eu-west-3.pooler.supabase.com"


class NativeBackupTests(unittest.TestCase):
    def test_only_correct_project_target_is_accepted(self):
        self.assertEqual(native.checked_target(HOST, "postgres." + backup.PROJECT_REF, 5432)[0], HOST)
        self.assertEqual(native.checked_target("db." + backup.PROJECT_REF + ".supabase.co", "postgres", 5432)[1], "postgres")
        for host, user, port in [
            ("db.example.com", "postgres", 5432),
            (HOST, "postgres.other-project", 5432),
            (HOST, "postgres." + backup.PROJECT_REF, 6543),
            ("db.other-project.supabase.co", "postgres", 5432),
            ("bad.pooler.supabase.co.evil.test", "postgres." + backup.PROJECT_REF, 5432)
        ]:
            with self.subTest(host=host, user=user), self.assertRaises(backup.BackupError):
                native.checked_target(host, user, port)

    def test_custom_backup_integrity_and_storage_status(self):
        payload = {"database/application.dump": b"PGDMP" + b"synthetic" * 40}
        encrypted = backup.seal(backup.build_zip(payload, backup.PROJECT_REF,
            {"bucket": backup.BUCKET, "status": "verified_empty_by_sql", "files": 0}), PASSWORD)
        _, manifest = backup.verified_archive(encrypted, PASSWORD)
        self.assertIn("database/application.dump", manifest["files"])
        self.assertEqual(manifest["storage"]["status"], "verified_empty_by_sql")
        invalid = backup.seal(backup.build_zip(
            {"database/application.dump": b"fake backup"}, backup.PROJECT_REF,
            {"bucket": backup.BUCKET, "status": "verified_empty_by_sql", "files": 0}), PASSWORD)
        with self.assertRaisesRegex(backup.BackupError, "header"):
            backup.verified_archive(invalid, PASSWORD)

    def test_encrypted_native_backup_and_fail_closed_cases(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            bin_dir = root / "bin"
            bin_dir.mkdir()
            code = textwrap.dedent("""\
                #!/usr/bin/env python3
                import os, sys
                args=sys.argv[1:]
                if os.getenv('PGPASSWORD') != 'fake-db-password-never-real': sys.exit(31)
                if os.getenv('PGHOST') != 'aws-0-eu-west-3.pooler.supabase.com': sys.exit(32)
                if os.getenv('PGUSER') != 'postgres.rzghbvmszbjlqkdjzpxc': sys.exit(33)
                name=os.path.basename(sys.argv[0])
                if name.startswith('psql'):
                    if 'storage.objects' in ' '.join(args):
                        print(os.getenv('FAKE_STORAGE_COUNT','0'))
                    else:
                        print('postgres')
                elif name.startswith('pg_dump'):
                    if os.getenv('FAIL_PG_DUMP') == '1': sys.exit(34)
                    sys.stdout.buffer.write(b'PGDMP'+ b'example-test-data-'*32)
                elif name.startswith('pg_restore'):
                    if os.getenv('FAIL_RESTORE_CHECK') == '1': sys.exit(35)
                    sys.stdout.write('synthetic archive listing')
                else:
                    sys.exit(36)
            """)
            for name in ("psql", "pg_dump", "pg_restore"):
                command = bin_dir / name
                command.write_text(code, encoding="utf8")
                command.chmod(0o700)

            def invoke(destination, extra=(), overrides=None):
                env = dict(os.environ, **(overrides or {}))
                return subprocess.run(
                    [sys.executable, str(ROOT / "tools" / "backup_dzoft_native.py"),
                     "--host", HOST, "--user", "postgres." + backup.PROJECT_REF,
                     "--pg-bin", str(bin_dir), "--destination", str(destination), *extra],
                    input=SECRET+"\n"+PASSWORD+"\n"+PASSWORD+"\n",
                    text=True, capture_output=True, env=env, timeout=40)

            out = root / "good"
            result = invoke(out)
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            archives = list(out.glob("*.dzoftbak"))
            self.assertEqual(len(archives), 1)
            self.assertFalse(list(out.rglob("*.sql")), "Native backup must not create plaintext SQL.")
            self.assertFalse(list(out.rglob("*.dump")), "Native backup must not create plaintext dump.")
            data = archives[0].read_bytes()
            self.assertNotIn(b"example-test-data", data)
            _, manifest = backup.verified_archive(data, PASSWORD)
            self.assertEqual(manifest["storage"]["status"], "verified_empty_by_sql")

            for label, vars in [
                ("storage-present", {"FAKE_STORAGE_COUNT": "1"}),
                ("dump-failed", {"FAIL_PG_DUMP": "1"}),
                ("archive-list-failed", {"FAIL_RESTORE_CHECK": "1"}),
            ]:
                with self.subTest(label=label):
                    dest = root / label
                    failed = invoke(dest, overrides=vars)
                    self.assertNotEqual(failed.returncode, 0)
                    self.assertFalse(list(dest.glob("*.dzoftbak")))

            partial = root / "partial"
            result = invoke(partial, extra=("--skip-storage",), overrides={"FAKE_STORAGE_COUNT": "1"})
            self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
            _, info = backup.verified_archive(next(partial.glob("*.dzoftbak")).read_bytes(), PASSWORD)
            self.assertEqual(info["storage"]["status"], "skipped_by_operator")


if __name__ == "__main__":
    unittest.main()
