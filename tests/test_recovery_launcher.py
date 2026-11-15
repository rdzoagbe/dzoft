#!/usr/bin/env python3
"""Static safety checks for the one-click Windows launcher (no real credentials)."""

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class LauncherChecks(unittest.TestCase):
    def test_launcher_pins_local_workflow_and_trusted_source(self):
        launcher = (ROOT / "Start-DZOFT-Recovery.cmd").read_text(encoding="utf-8")
        self.assertIn("127.0.0.1:55439", launcher)
        self.assertIn("DZOFT-Recovery-Lab\\pgdata\\PG_VERSION", launcher)
        self.assertIn("dzoft-20261115-145839Z-b191cd.dzoftbak", launcher)
        self.assertIn("git -C \"%REPO%\" pull --ff-only https://github.com/rdzoagbe/dzoft.git main", launcher)
        self.assertIn('python "tools\\restore_dzoft_lab_schema.py"', launcher)
        self.assertIn('if /i not "%DZOFT_BRANCH%"=="main" goto NO_MAIN', launcher)
        self.assertIn("if errorlevel 1 goto PULL_FAILED", launcher)
        self.assertIn('if not "%DZOFT_RESULT%"=="0" goto NEEDS_REVIEW', launcher)

    def test_launcher_never_hardcodes_prod_host_or_secrets(self):
        launcher = (ROOT / "Start-DZOFT-Recovery.cmd").read_text(encoding="utf-8").lower()
        self.assertNotIn("supabase.co", launcher)
        self.assertNotIn("rzghbvmszbjlqkdjzpxc", launcher)
        self.assertNotIn("pgpassword=", launcher)
        self.assertNotIn("set /p", launcher)
        self.assertNotIn("curl ", launcher)
        self.assertNotIn("powershell -enc", launcher)
        self.assertNotIn("--data-only", launcher)
        self.assertNotIn("--section=data", launcher)
        self.assertNotIn("--dbname=", launcher)

    def test_launcher_is_readable_plaintext(self):
        launcher = (ROOT / "Start-DZOFT-Recovery.cmd").read_text(encoding="utf-8")
        self.assertTrue(launcher.startswith("@echo off\n"))
        self.assertIn("pause\nendlocal", launcher)


if __name__ == "__main__":
    unittest.main()
