#!/usr/bin/env python3
"""Synthetic checks for the pinned DZOFT schema stage; NEVER connects to live data."""
from __future__ import annotations

from contextlib import redirect_stdout
import io
import os
from pathlib import Path
import sys
import tempfile
import textwrap
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import backup_dzoft as backup
import restore_dzoft_lab_schema as schema

ARCHIVE_PASSWORD = "synthetic-db-archive-password-do-not-reuse"
TOC = b"""4; 2615 0 SCHEMA - public postgres
5; 2615 1 SCHEMA - private postgres
6; 1259 2 TABLE public clients postgres
7; 1259 3 TABLE private notification_settings postgres
8; 0 2 TABLE DATA public clients postgres
9; 0 3 TABLE DATA private notification_settings postgres
"""


class SchemaStageTests(unittest.TestCase):
    def test_connect_arguments_pin_local_lab(self):
        args = schema.CONNECT
        self.assertEqual(args, [
            "--host=127.0.0.1", "--port=55439",
            "--username=dzoft_lab_admin", "--dbname=dzoft_restore_test"
        ])
        env = schema.pg_environment("synthetic")
        self.assertEqual(env["PGPASSWORD"], "synthetic")
        self.assertEqual(env["PGSSLMODE"], "disable")

    def test_safe_schema_restore_and_fail_closed_cases(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            cluster = root / "pgdata"
            cluster.mkdir()
            (cluster / "PG_VERSION").write_text("18", encoding="utf8")
            bin_path = root / "bin"
            bin_path.mkdir()
            marker = root / "restored.marker"
            psql = bin_path / ("psql.exe" if os.name == "nt" else "psql")
            pg_restore = bin_path / ("pg_restore.exe" if os.name == "nt" else "pg_restore")
            psql.write_text(textwrap.dedent("""\
                #!/usr/bin/env python3
                import os,sys
                args = sys.argv[1:]
                if not ('--host=127.0.0.1' in args and '--port=55439' in args
                    and '--dbname=dzoft_restore_test' in args
                    and '--username=dzoft_lab_admin' in args): sys.exit(91)
                if os.environ.get('PGPASSWORD') != 'lab-password': sys.exit(92)
                if os.environ.get('MOCK_BAD_LISTEN'):
                    listen='*'
                else: listen='127.0.0.1'
                marker=os.environ['TEST_LAB_MARKER']
                rows=2 if os.path.isfile(marker) else 0
                print('dzoft_restore_test|127.0.0.1|55439|'+
                      os.environ['TEST_LAB_DATA_DIR']+'|'+listen+'|'+str(rows)+'|2|3')
            """))
            pg_restore.write_text(textwrap.dedent("""\
                #!/usr/bin/env python3
                import os,sys
                args=sys.argv[1:]
                buf=sys.stdin.buffer.read()
                if not buf.startswith(b'PGDMP'): sys.exit(44)
                if '--list' in args:
                    sys.stdout.buffer.write(%r)
                else:
                    required=['--host=127.0.0.1','--port=55439',
                              '--username=dzoft_lab_admin','--dbname=dzoft_restore_test',
                              '--section=pre-data','--single-transaction','--exit-on-error',
                              '--no-owner','--no-privileges','--clean','--if-exists']
                    if not all(item in args for item in required): sys.exit(45)
                    if os.environ.get('MOCK_FAIL_RESTORE'):
                        sys.stderr.write('ERROR: schema "auth" does not exist')
                        sys.exit(46)
                    open(os.environ['TEST_LAB_MARKER'],'w').write('synthetic-only')
            """ % TOC))
            psql.chmod(0o700)
            pg_restore.chmod(0o700)
            zipped = backup.build_zip({"database/application.dump": b"PGDMP" + b"synthetic" * 25},
                                      backup.PROJECT_REF,
                                      {"bucket": backup.BUCKET,
                                       "status": "verified_empty_by_sql", "files": 0})
            encrypted = backup.seal(zipped, ARCHIVE_PASSWORD)
            source = root / "synthetic.dzoftbak"
            source.write_bytes(encrypted)

            patch_env = {
                "TEST_LAB_MARKER": str(marker),
                "TEST_LAB_DATA_DIR": str(cluster).replace("\\", "/")
            }
            def invoke(overrides=None, passes=("lab-password", ARCHIVE_PASSWORD)):
                stream = io.StringIO()
                with patch.dict(os.environ, dict(patch_env, **(overrides or {}))), \
                     patch.object(schema, "EXPECTED_DATA_DIR", cluster), \
                     patch.object(schema.getpass, "getpass", side_effect=passes), \
                     redirect_stdout(stream):
                    schema.run(source, bin_path)
                return stream.getvalue()

            self.assertIn("PASS: Local PRE-DATA table definitions restored.", invoke())
            self.assertTrue(marker.is_file())
            with self.assertRaisesRegex(backup.BackupError, "not empty"):
                invoke()
            marker.unlink()
            with self.assertRaisesRegex(backup.BackupError, "wrong local lab"):
                invoke({"MOCK_BAD_LISTEN": "1"})
            self.assertFalse(marker.exists())
            with self.assertRaises(Exception):
                invoke(passes=("lab-password", "bad-archive-password"))
            self.assertFalse(marker.exists())
            with self.assertRaisesRegex(backup.BackupError, "Schema restore blocked"):
                result = invoke({"MOCK_FAIL_RESTORE": "1"})
            self.assertFalse(marker.exists(), "A failing restore must not commit any marker.")
            self.assertFalse(list(root.rglob("*.sql")), "No plaintext SQL files allowed.")
            self.assertFalse(list(root.rglob("*.dump")), "No plaintext .dump files allowed.")

    def test_restore_failure_is_sanitized(self):
        # Preserve only a generic error category, never raw SQL or private records.
        with patch.object(schema.subprocess, "run") as run:
            run.return_value.returncode = 1
            run.return_value.stderr = b'ERROR: schema "auth" does not exist\nCONTEXT: sensitive SQL'
            ok, reason = schema.pg_restore_schema("pg_restore", b"PGDMPtest", {"PGPASSWORD": "fake"})
        self.assertFalse(ok)
        self.assertIn("auth schema", reason)
        self.assertNotIn("sensitive SQL", reason)


if __name__ == "__main__":
    unittest.main()
