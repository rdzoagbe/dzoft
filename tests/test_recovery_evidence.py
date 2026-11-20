#!/usr/bin/env python3
"""Synthetic checks for DZOFT offline backup evidence, never production data."""
from __future__ import annotations

from contextlib import redirect_stdout, redirect_stderr
from datetime import datetime, timedelta, timezone
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
import uuid
from unittest.mock import patch

TOOLS=Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0,str(TOOLS))
import backup_dzoft as backup
import backup_dzoft_auth as auth
import check_dzoft_recovery as gate

PW="synthetic-archived-data-password-never-use"
AUTH_PW="synthetic-auth-metadata-password-never-use"
NOW=datetime.now(timezone.utc)
SCHEMA=b"CREATE SCHEMA private; CREATE TABLE public.test_documents (id uuid);"
DATA=b"COPY public.test_documents FROM stdin;\n\\.\n"
ROLES=b"-- synthetic role definitions ONLY"
FAKE_STORAGE={
 "storage/client-files/synthetic-a.pdf":b"%PDF-1.7\nA",
 "storage/client-files/synthetic-b.pdf":b"%PDF-1.7\nB",
 "storage/client-files/synthetic-c.pdf":b"%PDF-1.7\nC",
}

def archive(status="exported",count=3,storage_files=FAKE_STORAGE):
 members={"database/schema.sql":SCHEMA,"database/data.sql":DATA,"database/roles.sql":ROLES}
 members.update(storage_files)
 return backup.seal(backup.build_zip(members,backup.PROJECT_REF,
     {"bucket":backup.BUCKET,"status":status,"files":count}),PW)

def auth_file(users=3):
 users_data=[]
 for i in range(users):
  users_data.append({
   "source_user_id":str(uuid.uuid5(uuid.NAMESPACE_DNS,"dzoft-synthetic-"+str(i))),
   "email":f"synthetic-{i}@example.invalid",
   "email_confirmed":True,
   "owner_claim":i==0,
   "providers":["email"],
   "verified_factor_types":[],
   "registered_passkeys":0,
   "client_refs":0,
   "lead_refs":0,
   "notification_settings_refs":0
  })
 obj={
  "format":auth.FORMAT,"source_project_ref":backup.PROJECT_REF,
  "captured_at_utc":NOW.isoformat(),"active_user_count":len(users_data),
  "accounts":users_data
 }
 return auth.seal_inventory(json.dumps(obj).encode(),AUTH_PW)

class RecoveryEvidenceTests(unittest.TestCase):
 def test_complete_bundle_always_requires_real_isolated_restore(self):
  original=archive()
  ok,pending=gate.evaluate(archive_blob=original,archive_password=PW,
   expected_storage_count=3,expected_auth_count=3,auth_blob=auth_file(),
   auth_password=AUTH_PW,offsite_blob=bytes(bytearray(original)),pg_bin=None,
   max_age_hours=72,now=NOW)
  self.assertTrue(any("Storage" in x for x in ok))
  self.assertTrue(any("Auth mapping" in x for x in ok))
  self.assertTrue(any("off-site" in x for x in ok))
  self.assertTrue(any("NOT VERIFIED" in x for x in pending))
  self.assertTrue(any("rendering was not attempted" in x for x in pending))
  self.assertFalse(any("synthetic-a.pdf" in s for s in [*ok,*pending]))

 def test_missing_storage_bytes_and_partial_archive_are_blocked(self):
  with self.assertRaisesRegex(gate.EvidenceFailure,"Storage"):
   gate.backup_evidence(archive("verified_empty_by_cli",0,{}),PW,
                        expected_storage=3,max_age_hours=72,now=NOW)
  with self.assertRaisesRegex(gate.EvidenceFailure,"count"):
   gate.backup_evidence(archive(),PW,expected_storage=4,max_age_hours=72,now=NOW)
  with self.assertRaises(gate.EvidenceFailure):
   gate.backup_evidence(archive("skipped_by_operator",0,{}),PW,
                        expected_storage=3,max_age_hours=72,now=NOW)

 def test_cipher_tamper_and_passphrase_error_never_leak_member_paths(self):
  payload=archive();corrupted=payload[:-2]+bytes([payload[-2]^1])+payload[-1:]
  for bad,passphrase in [(corrupted,PW),(payload,"wrong-password")]:
   try:
    gate.backup_evidence(bad,passphrase,expected_storage=3,max_age_hours=72,now=NOW)
   except gate.EvidenceFailure as exc:
    self.assertNotIn("storage/client-files",str(exc))
    self.assertNotIn(PW,str(exc))
   else:
    self.fail("Malformed ciphertext or bad password accepted")

 def test_independent_copy_must_match_and_verify_again(self):
  baseline=archive()
  gate.offsite_evidence(baseline,baseline,PW)
  with self.assertRaisesRegex(gate.EvidenceFailure,"differs"):
   gate.offsite_evidence(baseline,archive(),PW)
  with self.assertRaisesRegex(gate.EvidenceFailure,"differs"):
   gate.offsite_evidence(baseline,b"totally unrelated bytes",PW)

 def test_auth_inventory_requires_exact_user_count_and_one_owner(self):
  state=gate.auth_evidence(auth_file(),AUTH_PW,expected_users=3,max_age_hours=72,now=NOW)
  self.assertEqual(state["users"],3)
  self.assertTrue(state["recent"])
  with self.assertRaisesRegex(gate.EvidenceFailure,"count"):
   gate.auth_evidence(auth_file(),AUTH_PW,expected_users=4,max_age_hours=72,now=NOW)

 def test_stale_backup_and_auth_record_are_not_treated_as_fresh(self):
  future=NOW+timedelta(days=6)
  evidence,_=gate.backup_evidence(archive(),PW,expected_storage=3,max_age_hours=72,now=future)
  self.assertFalse(evidence["recent"])
  info=gate.auth_evidence(auth_file(),AUTH_PW,expected_users=3,max_age_hours=72,now=future)
  self.assertFalse(info["recent"])
  with self.assertRaisesRegex(gate.EvidenceFailure,"future"):
   gate.backup_evidence(archive(),PW,expected_storage=3,max_age_hours=72,now=NOW-timedelta(days=2))

 def test_native_pg_probe_cannot_claim_restored_db(self):
  original=archive()
  dummy={"evaluated":True,"tables":26,"table_data_entries":26,"functions":10,
         "policies":1,"auth_dependencies":True}
  with patch.object(gate,"pg_evidence",return_value=dummy):
   good,pending=gate.evaluate(archive_blob=original,archive_password=PW,
    expected_storage_count=3,expected_auth_count=3,auth_blob=auth_file(),
    auth_password=AUTH_PW,offsite_blob=bytes(bytearray(original)),pg_bin=Path("/synthetic"),
    max_age_hours=72,now=NOW)
  self.assertTrue(any("SQL render" in s for s in good))
  self.assertTrue(any("Auth dependencies" in s for s in pending))
  self.assertTrue(any("NOT VERIFIED" in s for s in pending))

 def test_no_network_or_database_client_required(self):
  source=Path(gate.__file__).read_text(encoding="utf8")
  self.assertNotIn("supabase.create_client",source)
  self.assertNotIn("psql -d",source)
  self.assertNotIn("curl ",source)
  self.assertNotIn("requests.get",source)
  self.assertNotIn("urllib.request",source)

 def test_main_refuses_alias_file_as_offsite_and_prints_no_path(self):
  with tempfile.TemporaryDirectory() as tmp:
   file=Path(tmp)/"synthetic.dzoftbak"
   file.write_bytes(archive())
   stdout,stderr=io.StringIO(),io.StringIO()
   with redirect_stdout(stdout),redirect_stderr(stderr):
    result=gate.main(["--archive",str(file),"--offsite-copy",str(file),
     "--expected-storage-count","3","--expected-auth-count","3"])
   self.assertEqual(result,2)
   self.assertIn("different file",stderr.getvalue())
   self.assertNotIn(str(file),stderr.getvalue())
   self.assertNotIn(PW,stderr.getvalue())
   self.assertNotIn("synthetic-a.pdf",stdout.getvalue())

 def test_missing_auth_evidence_cannot_silently_pass(self):
  good,pending=gate.evaluate(archive_blob=archive(),archive_password=PW,
   expected_storage_count=3,expected_auth_count=3,auth_blob=None,
   auth_password=None,offsite_blob=None,pg_bin=None,max_age_hours=72,now=NOW)
  self.assertTrue(good)
  self.assertGreaterEqual(len(pending),3)
  self.assertTrue(any("Auth" in x for x in pending))

if __name__ == "__main__":
 unittest.main()
