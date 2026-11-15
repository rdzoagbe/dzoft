#!/usr/bin/env python3
"""Synthetic OFFLINE tests for DZOFT pg_restore preflight; no real customer data."""
from __future__ import annotations

import io
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
import preflight_dzoft_restore as preflight

PASSWORD = "synthetic-never-use-in-production-passphrase-2026"
TOC = b""";
; Archive created at 2026-11-15
; dbname: postgres
;
3; 2615 2200 SCHEMA - public postgres
4; 2615 2201 SCHEMA - private postgres
12; 1259 200 TABLE public clients postgres
13; 1259 201 TABLE private notification_settings postgres
23; 0 200 TABLE DATA public clients postgres
24; 0 201 TABLE DATA private notification_settings postgres
25; 2606 222 FK CONSTRAINT public clients clients_user_id_fkey postgres
26; 0 222 POLICY public clients self_access postgres
27; 1255 223 FUNCTION public is_owner() postgres
"""
SCHEMA = b"""
CREATE SCHEMA private;
CREATE TABLE public.clients(user_id uuid);
ALTER TABLE ONLY public.clients
  ADD CONSTRAINT clients_user_id_fkey
  FOREIGN KEY(user_id) REFERENCES auth.users(id);
CREATE POLICY self_access ON public.clients USING (auth.uid() = user_id);
CREATE FUNCTION private.audit() RETURNS boolean LANGUAGE sql
  AS $$ SELECT true FROM storage.objects LIMIT 1 $$;
"""


def encrypted_archive(content: bytes | None = None) -> bytes:
    blob = content if content is not None else b"PGDMP" + b"synthetic example archive" * 12
    return backup.seal(backup.build_zip(
        {"database/application.dump": blob},
        backup.PROJECT_REF,
        {"bucket": backup.BUCKET, "status": "verified_empty_by_sql", "files": 0}
    ), PASSWORD)


class PreflightTests(unittest.TestCase):
    def test_audit_counts_do_not_confuse_table_data(self):
        counts = preflight.audit_toc(TOC)
        self.assertEqual(counts["tables"], 2)
        self.assertEqual(counts["table_data"], 2)
        self.assertEqual(counts["foreign_keys"], 1)
        self.assertEqual(counts["schemas_seen"], ["private", "public"])
        self.assertFalse(counts["has_managed_auth"])
        checks = preflight.audit_schema_sql(SCHEMA)
        self.assertTrue(checks["auth_user_fk_reference"])
        self.assertTrue(checks["auth_helper_reference"])
        self.assertTrue(checks["storage_reference"])

    def test_refuses_empty_or_missing_tables(self):
        for data in (b"", b"; no objects\n", b"3; 0 42 COMMENT - example postgres\n"):
            with self.assertRaises(backup.BackupError):
                preflight.audit_toc(data)

    def test_pg_restore_modes_cannot_target_database(self):
        for mode in ("list", "schema", "render"):
            cmd = preflight.pg_restore_command("/synthetic/pg_restore", mode)
            self.assertNotIn("-d", cmd)
            self.assertFalse(any(x.startswith("--dbname") for x in cmd))
            self.assertFalse(any(x.startswith("--clean") or x in ("-c", "-C") for x in cmd))
        os.environ["PGHOST"] = "should-not-propagate.example"
        os.environ["PGPASSWORD"] = "synthetic-password-not-to-pass"
        env = preflight.pg_env()
        self.assertNotIn("PGHOST", env)
        self.assertNotIn("PGPASSWORD", env)
        del os.environ["PGHOST"]
        del os.environ["PGPASSWORD"]

    def test_offline_preflight_success_bad_password_and_failclosed(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            bin_dir = base / "postgres" / "bin"
            bin_dir.mkdir(parents=True)
            fake = bin_dir / ("pg_restore.exe" if os.name == "nt" else "pg_restore")
            fake.write_text(textwrap.dedent("""\
                #!/usr/bin/env python3
                import os,sys
                args = sys.argv[1:]
                if any(x in args for x in ('-d','--dbname','--clean','-C')): sys.exit(40)
                if any(x.startswith('--dbname=') for x in args): sys.exit(41)
                if os.environ.get('PGHOST') or os.environ.get('PGPASSWORD'): sys.exit(42)
                buf = sys.stdin.buffer.read()
                if not buf.startswith(b'PGDMP'): sys.exit(43)
                if '--list' in args:
                    if os.environ.get('FAIL_LIST'): sys.exit(44)
                    sys.stdout.buffer.write(%r)
                elif '--schema-only' in args:
                    if os.environ.get('FAIL_SCHEMA'): sys.exit(45)
                    sys.stdout.buffer.write(%r)
                else:
                    if os.environ.get('FAIL_RENDER'): sys.exit(46)
                    sys.stdout.buffer.write(b'synthetic test data that should NOT be printed')
            """ % (TOC, SCHEMA)))
            fake.chmod(0o700)
            archive = base / "test.dzoftbak"
            archive.write_bytes(encrypted_archive())
            args = [sys.executable, str(ROOT / "tools" / "preflight_dzoft_restore.py"),
                    "--archive", str(archive), "--pg-bin", str(bin_dir)]
            good = subprocess.run(args, input=PASSWORD+"\n", text=True,
                                  capture_output=True, timeout=40)
            self.assertEqual(good.returncode, 0, good.stderr + good.stdout)
            self.assertIn("PASS: pg_restore TOC, schema SQL and full SQL render succeeded OFFLINE.", good.stdout)
            self.assertIn("BLOCKER: application schema includes foreign keys to managed auth.users.", good.stdout)
            self.assertIn("NOT VERIFIED", good.stdout)
            self.assertNotIn("synthetic test data", good.stdout)
            self.assertNotIn("CREATE TABLE", good.stdout)
            self.assertEqual(set(base.glob("*.sql")), set())
            self.assertEqual(set(base.rglob("*.dump")), set())

            badpw = subprocess.run(args, input="wrong-passphrase\n", text=True,
                                   capture_output=True, timeout=40)
            self.assertNotEqual(badpw.returncode, 0)
            self.assertNotIn(PASSWORD, badpw.stdout + badpw.stderr)

            for mode in ("LIST", "SCHEMA", "RENDER"):
                failed = subprocess.run(
                    args, input=PASSWORD+"\n", text=True, capture_output=True,
                    env={**os.environ, f"FAIL_{mode}": "1"}, timeout=40
                )
                self.assertNotEqual(failed.returncode, 0, failed.stdout)
                self.assertIn("ERROR", failed.stderr)
                self.assertNotIn("synthetic test data", failed.stdout + failed.stderr)

            archive.write_bytes(backup.seal(backup.build_zip(
                {"database/schema.sql": b"CREATE TABLE test (id int);",
                 "database/data.sql": b"COPY test FROM stdin;\n\\.\n",
                 "database/roles.sql": b"-- synthetic roles"},
                backup.PROJECT_REF,
                {"bucket": backup.BUCKET, "status": "verified_empty_by_sql", "files": 0}
            ), PASSWORD))
            split = subprocess.run(args, input=PASSWORD+"\n", text=True,
                                   capture_output=True, timeout=40)
            self.assertNotEqual(split.returncode, 0)
            self.assertIn("native PostgreSQL", split.stderr)


if __name__ == "__main__":
    unittest.main()
