#!/usr/bin/env python3
"""Synthetic tests for the DZOFT offline backup helper. No production access."""
from __future__ import annotations

import importlib.util
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "backup_dzoft.py"
spec = importlib.util.spec_from_file_location("dzoft_backup", SCRIPT)
assert spec and spec.loader
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

PASSWORD = "test-passphrase-not-real-32"


class BackupTests(unittest.TestCase):

    def test_crypto_self_test(self):
        mod.self_test()

    def test_invalid_password_or_mutation_fails_closed(self):
        original = mod.seal(b"synthetic text not a real backup", PASSWORD)
        with self.assertRaises(mod.BackupError):
            mod.unseal(original, "not-the-password")
        altered = original[:-1] + bytes([original[-1] ^ 1])
        with self.assertRaises(mod.BackupError):
            mod.unseal(altered, PASSWORD)

    def test_manifest_checksums_and_no_secrets(self):
        sample = {
            "database/schema.sql": b"CREATE TABLE public.fake (id uuid);",
            "database/data.sql": b"COPY fake FROM stdin;\n",
            "database/roles.sql": b"-- fake roles\n",
        }
        zipped = mod.build_zip(sample, mod.PROJECT_REF, {
            "bucket": mod.BUCKET, "status": "verified_empty_by_cli", "files": 0})
        encrypted = mod.seal(zipped, PASSWORD)
        self.assertTrue(encrypted.startswith(mod.MAGIC))
        self.assertNotIn(b"COPY fake", encrypted)
        restored, manifest = mod.verified_archive(encrypted, PASSWORD)
        self.assertEqual(restored, zipped)
        self.assertEqual(len(manifest["files"]), 3)

    def test_fake_cli_success_storage_and_failure(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            cli = root / "fake_supabase"
            cli.write_text(textwrap.dedent("""\
                #!/usr/bin/env python3
                import os, pathlib, sys
                args = sys.argv[1:]
                if os.getenv("FAIL_DUMP") == "1" and args[:2] == ["db", "dump"]:
                    sys.exit(2)
                if args[:2] == ["db", "dump"]:
                    if "--data-only" in args:
                        sys.stdout.write("COPY fake FROM stdin;\\n1\\n\\\\.\\n")
                    else:
                        sys.stdout.write("-- fake SQL export\\n")
                    sys.exit(0)
                if args[:2] == ["storage", "ls"]:
                    if os.getenv("WITH_STORAGE") == "1":
                        sys.stdout.write("invoice.pdf\\n")
                    sys.exit(0)
                if args[:2] == ["storage", "cp"]:
                    dst = pathlib.Path(args[5]) if args[2] == "-r" else pathlib.Path(args[4])
                    dst.mkdir(parents=True, exist_ok=True)
                    (dst / "invoice.pdf").write_bytes(b"synthetic PDF bytes")
                    sys.exit(0)
                sys.exit(3)
            """), encoding="utf8")
            cli.chmod(0o700)

            for with_storage in (False, True):
                target = root / ("storaged" if with_storage else "empty")
                env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli),
                           WITH_STORAGE="1" if with_storage else "0")
                result = subprocess.run(
                    [sys.executable, str(SCRIPT), "backup", "--destination", str(target)],
                    input=PASSWORD + "\n" + PASSWORD + "\n",
                    text=True, capture_output=True, env=env, timeout=40)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                files = list(target.glob("*.dzoftbak"))
                self.assertEqual(len(files), 1)
                self.assertFalse(list(target.glob("*.sql")))
                _, info = mod.verified_archive(files[0].read_bytes(), PASSWORD)
                expected = "exported" if with_storage else "verified_empty_by_cli"
                self.assertEqual(info["storage"]["status"], expected)

            failed = root / "failed"
            env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), FAIL_DUMP="1")
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "backup", "--destination", str(failed)],
                input=PASSWORD + "\n" + PASSWORD + "\n",
                capture_output=True, text=True, env=env, timeout=40)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(failed.glob("*.dzoftbak")), [])


if __name__ == "__main__":
    unittest.main()
