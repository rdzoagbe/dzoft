#!/usr/bin/env python3
"""Synthetic tests for the DZOFT offline backup helper. No production access."""
from __future__ import annotations

import importlib.util
import io
import json
import warnings
import zipfile
from unittest.mock import patch
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

    def test_partial_storage_and_required_database_members_rejected(self):
        db = {
            "database/schema.sql": b"CREATE TABLE fake(id int);",
            "database/data.sql": b"INSERT INTO fake VALUES (1);",
            "database/roles.sql": b"-- role definitions",
        }
        partial = mod.build_zip(db, mod.PROJECT_REF, {
            "bucket": mod.BUCKET, "status": "skipped_by_operator", "files": 0})
        _, info = mod.verified_archive(mod.seal(partial, PASSWORD), PASSWORD)
        self.assertEqual(info["storage"]["status"], "skipped_by_operator")

        incomplete = dict(db)
        incomplete.pop("database/roles.sql")
        blob = mod.build_zip(incomplete, mod.PROJECT_REF, {
            "bucket": mod.BUCKET, "status": "verified_empty_by_cli", "files": 0})
        with self.assertRaisesRegex(mod.BackupError, "Database schema, data or roles"):
            mod.verified_archive(mod.seal(blob, PASSWORD), PASSWORD)

        wrong_count = mod.build_zip({**db, "storage/client-files/example.pdf": b"fictional"}, mod.PROJECT_REF, {
            "bucket": mod.BUCKET, "status": "exported", "files": 2})
        with self.assertRaisesRegex(mod.BackupError, "Storage download count"):
            mod.verified_archive(mod.seal(wrong_count, PASSWORD), PASSWORD)

        wrong_ref = mod.build_zip(db, "not-the-DZOFT-project", {
            "bucket": mod.BUCKET, "status": "verified_empty_by_cli", "files": 0})
        with self.assertRaisesRegex(mod.BackupError, "does not match"):
            mod.verified_archive(mod.seal(wrong_ref, PASSWORD), PASSWORD)

    def test_rejects_traversal_duplicates_symlinks_and_zip_bomb(self):
        db = {
            "database/schema.sql": b"CREATE TABLE fake(id int);",
            "database/data.sql": b"INSERT INTO fake VALUES (1);",
            "database/roles.sql": b"-- role definitions",
        }
        storage = {"bucket": mod.BUCKET, "status": "verified_empty_by_cli", "files": 0}
        with self.assertRaisesRegex(mod.BackupError, "Unsafe archive entry"):
            blob = mod.build_zip({**db, "storage/../../escape.txt": b"outside"}, mod.PROJECT_REF, storage)
            mod.verified_archive(mod.seal(blob, PASSWORD), PASSWORD)

        original = mod.build_zip(db, mod.PROJECT_REF, storage)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            with zipfile.ZipFile(io.BytesIO(original)) as original_zip:
                for entry in original_zip.infolist():
                    z.writestr(entry.filename, original_zip.read(entry.filename))
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                z.writestr("database/schema.sql", b"duplicate")
        with self.assertRaisesRegex(mod.BackupError, "Duplicate archive"):
            mod.verified_archive(mod.seal(buf.getvalue(), PASSWORD), PASSWORD)

        bomb = mod.build_zip({**db, "database/big.sql": b"x" * 5000}, mod.PROJECT_REF, storage)
        with patch.object(mod, "MAX_UNCOMPRESSED_BYTES", 1000):
            with self.assertRaisesRegex(mod.BackupError, "expands beyond"):
                mod.verified_archive(mod.seal(bomb, PASSWORD), PASSWORD)

        with patch.object(mod, "MAX_ARCHIVE_ENTRIES", 2):
            with self.assertRaisesRegex(mod.BackupError, "too many entries"):
                mod.verified_archive(mod.seal(original, PASSWORD), PASSWORD)

    def test_invalid_storage_manifest_never_counts_as_complete(self):
        db = {
            "database/schema.sql": b"CREATE TABLE fake(id int);",
            "database/data.sql": b"INSERT INTO fake VALUES (1);",
            "database/roles.sql": b"-- fake roles",
        }
        for status in ("exported", "unknown", "verified_empty_by_cli"):
            blob = mod.build_zip(db, mod.PROJECT_REF, {
                "bucket": mod.BUCKET, "status": status, "files": 1})
            with self.subTest(status=status), self.assertRaises(mod.BackupError):
                mod.verified_archive(mod.seal(blob, PASSWORD), PASSWORD)

    def test_bucket_file_selection_ignores_cli_metadata_but_not_malicious_links(self):
        with tempfile.TemporaryDirectory(prefix="dzoft-storage-") as scratch:
            root = Path(scratch)
            folder = root / mod.BUCKET / "subdir"
            folder.mkdir(parents=True)
            for i in range(3):
                (folder / ("fixture-%s.pdf" % i)).write_bytes(b"fake PDF")
            (root / "supabase" / ".temp").mkdir(parents=True)
            (root / "supabase" / ".temp" / "project-ref").write_text("fake")
            (root / "supabase" / ".temp" / "cli-version").write_text("fake")
            actual = mod.downloaded_bucket_files(root)
            self.assertEqual(len(actual), 3)
            self.assertTrue(all(mod.BUCKET in p.parts for p in actual))
            self.assertFalse(any("project-ref" in str(p) for p in actual))
            # A missing bucket must never pass merely because workdir files exist.
            for p in actual:
                p.unlink()
            with self.assertRaises(mod.BackupError):
                mod.downloaded_bucket_files(root / "supabase")


    def test_fake_cli_success_storage_and_failure(self):
        with tempfile.TemporaryDirectory() as scratch:
            root = Path(scratch)
            cli = root / "fake_supabase"
            cli.write_text(textwrap.dedent("""\
                #!/usr/bin/env python3
                import os, pathlib, sys
                args = sys.argv[1:]
                if args[:1] == ["link"]:
                    if os.getenv("FAIL_LINK") == "1":
                        sys.exit(6)
                    if args != ["link", "--project-ref", "rzghbvmszbjlqkdjzpxc"]:
                        sys.exit(7)
                    sys.exit(0)
                mode = os.getenv("CLI_MODE", "v2")
                if len(args) >= 3 and args[2] == "--help" and (
                    args[:2] == ["db", "dump"] or args[:2] == ["storage", "ls"] or args[:2] == ["storage", "cp"]
                ):
                    if mode == "v3":
                        print("      --remote[=<ref>]  target a hosted project")
                    elif mode == "v2":
                        print("      --linked  use the linked project")
                    else:
                        print("No remote selection flags available")
                    sys.exit(0)
                if os.getenv("FAIL_DUMP") == "1" and args[:2] == ["db", "dump"]:
                    sys.exit(2)
                if args[:2] == ["db", "dump"]:
                    expected = "--remote=rzghbvmszbjlqkdjzpxc" if mode == "v3" else "--linked"
                    if expected not in args or (mode == "v3" and "--linked" in args):
                        sys.exit(8)
                    if "--role-only" not in args and "--schema=public,private" not in args:
                        sys.exit(9)
                    if "--data-only" in args:
                        sys.stdout.write("COPY fake FROM stdin;\\n1\\n\\\\.\\n")
                    else:
                        sys.stdout.write("-- fake SQL export\\n")
                    sys.exit(0)
                if args[:2] == ["storage", "ls"]:
                    expected = "--remote=rzghbvmszbjlqkdjzpxc" if mode == "v3" else "--linked"
                    if expected not in args or "--experimental" not in args:
                        sys.exit(10)
                    if os.getenv("WITH_STORAGE") == "1":
                        sys.stdout.write("invoice.pdf\\n")
                    sys.exit(0)
                if args[:2] == ["storage", "cp"]:
                    expected = "--remote=rzghbvmszbjlqkdjzpxc" if mode == "v3" else "--linked"
                    if expected not in args or "--experimental" not in args:
                        sys.exit(11)
                    # Exactly the documented relative destination from inside
                    # the private temp folder; an absolute Windows path is unsafe
                    # across CLI v2/v3 path parsers.
                    if args[4] != "." or not pathlib.Path.cwd().name.startswith("dzoft-storage-"):
                        sys.exit(12)
                    if mode == "v3" and "--remote" in args:
                        sys.exit(13)  # Bare target is ambiguous outside project cwd.
                    dst = pathlib.Path.cwd()
                    bucket = dst / "client-files"
                    bucket.mkdir(parents=True, exist_ok=True)
                    (bucket / "invoice.pdf").write_bytes(b"synthetic PDF bytes")
                    # Real Supabase CLI 3.1 creates unrelated workdir metadata.
                    # Never count or include these helper files in the archive.
                    cli_meta = dst / "supabase" / ".temp"
                    cli_meta.mkdir(parents=True, exist_ok=True)
                    (cli_meta / "project-ref").write_text("synthetic project marker")
                    (cli_meta / "cli-version").write_text("synthetic version")
                    sys.exit(0)
                sys.exit(3)
            """), encoding="utf8")
            cli.chmod(0o700)

            for with_storage in (False, True):
                target = root / ("storaged" if with_storage else "empty")
                env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli),
                           WITH_STORAGE="1" if with_storage else "0")
                result = subprocess.run(
                    [sys.executable, str(SCRIPT), "backup", "--destination", str(target)]
                    + (["--expected-storage-count", "1"] if with_storage else []),
                    input=PASSWORD + "\n" + PASSWORD + "\n",
                    text=True, capture_output=True, env=env, timeout=40)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                files = list(target.glob("*.dzoftbak"))
                self.assertEqual(len(files), 1)
                self.assertFalse(list(target.glob("*.sql")))
                _, info = mod.verified_archive(files[0].read_bytes(), PASSWORD)
                expected = "exported" if with_storage else "verified_empty_by_cli"
                self.assertEqual(info["storage"]["status"], expected)
                if with_storage:
                    self.assertIn("storage/client-files/invoice.pdf", info["files"])
                    self.assertNotIn("storage/client-files/client-files/invoice.pdf", info["files"])
                    self.assertNotIn("storage/client-files/supabase/.temp/project-ref", info["files"])

            for with_storage in (False, True):
                target = root / ("modern-storage" if with_storage else "modern-empty")
                env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), CLI_MODE="v3",
                           WITH_STORAGE="1" if with_storage else "0")
                result = subprocess.run(
                    [sys.executable, str(SCRIPT), "backup", "--destination", str(target)]
                    + (["--expected-storage-count", "1"] if with_storage else []),
                    input=PASSWORD + "\n" + PASSWORD + "\n",
                    text=True, capture_output=True, env=env, timeout=40)
                self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
                files = list(target.glob("*.dzoftbak"))
                self.assertEqual(len(files), 1)
                _, info = mod.verified_archive(files[0].read_bytes(), PASSWORD)
                expected = "exported" if with_storage else "verified_empty_by_cli"
                self.assertEqual(info["storage"]["status"], expected)
                if with_storage:
                    self.assertIn("storage/client-files/invoice.pdf", info["files"])
                    self.assertNotIn("storage/client-files/client-files/invoice.pdf", info["files"])
                    self.assertNotIn("storage/client-files/supabase/.temp/project-ref", info["files"])

            # A nonempty Storage set must never be called complete without an
            # independently verified object count from a current SQL inventory.
            for label, count in (("missing-count", None),
                                 ("under-count", "0"),
                                 ("over-count", "2")):
                target = root / label
                args = [sys.executable, str(SCRIPT), "backup", "--destination", str(target)]
                if count is not None:
                    args += ["--expected-storage-count", count]
                result = subprocess.run(
                    args, input=PASSWORD + "\n" + PASSWORD + "\n",
                    capture_output=True, text=True,
                    env=dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), WITH_STORAGE="1"),
                    timeout=40)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertEqual(list(target.glob("*.dzoftbak")), [])

            # Stale SQL inventory (e.g., three new documents while CLI sees none)
            # cannot masquerade as a verified empty Storage bucket.
            target = root / "unexpected-empty"
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "backup", "--destination",
                 str(target), "--expected-storage-count", "3"],
                input=PASSWORD + "\n" + PASSWORD + "\n",
                capture_output=True, text=True,
                env=dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), WITH_STORAGE="0"),
                timeout=40)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(target.glob("*.dzoftbak")), [])

            # Probe only downloads a sandboxed fixture, reports counts, and
            # does not invoke db dump or produce a durable backup archive.
            for n,success in (("1",True),("2",False)):
                target = root / ("probe-" + n)
                env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), CLI_MODE="v3",
                           WITH_STORAGE="1", FAIL_DUMP="1")
                result = subprocess.run(
                    [sys.executable, str(SCRIPT), "probe-storage",
                     "--expected-storage-count", n],
                    input="", text=True, capture_output=True, env=env,
                    cwd=str(target.parent), timeout=40)
                self.assertEqual(result.returncode == 0, success, result.stderr + result.stdout)
                self.assertIn("Local downloaded file count: 1", result.stdout)
                self.assertIn("Expected SQL object count: " + n, result.stdout)
                self.assertEqual(list(target.glob("*.dzoftbak")), [])
                self.assertNotIn("invoice.pdf", result.stdout)
            # With no recognized remote flag, never dump local data by accident.
            unknown = root / "unknown-cli"
            env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), CLI_MODE="unknown")
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "backup", "--destination", str(unknown)],
                input=PASSWORD + "\n" + PASSWORD + "\n",
                capture_output=True, text=True, env=env, timeout=40)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(unknown.glob("*.dzoftbak")), [])

            failed = root / "failed"
            env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), FAIL_DUMP="1")
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "backup", "--destination", str(failed)],
                input=PASSWORD + "\n" + PASSWORD + "\n",
                capture_output=True, text=True, env=env, timeout=40)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(failed.glob("*.dzoftbak")), [])

            # Fail closed if the requested project cannot be linked: no exports run.
            blocked = root / "unlinked"
            env = dict(os.environ, DZOFT_SUPABASE_CLI=str(cli), FAIL_LINK="1")
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "backup", "--destination", str(blocked)],
                input=PASSWORD + "\n" + PASSWORD + "\n",
                capture_output=True, text=True, env=env, timeout=40)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(list(blocked.glob("*.dzoftbak")), [])


if __name__ == "__main__":
    unittest.main()
