"""I3 SQLite integration checks using only synthetic, non-personal fixtures."""
import sqlite3
from pathlib import Path

MIGRATIONS=sorted(Path("migrations").glob("*.sql"))
ACTOR="00000000-0000-4000-8000-000000000010"; UNIT_A="00000000-0000-4000-8000-000000000001"; UNIT_B="00000000-0000-4000-8000-000000000002"
MEMBER_A="00000000-0000-4000-8000-000000000020"; MEMBER_B="00000000-0000-4000-8000-000000000021"; NOW="2026-01-02T00:00:00.000Z"
def apply(db, files):
 for f in files: db.executescript(f.read_text())
 assert list(db.execute("PRAGMA foreign_key_check"))==[]
def database(upgrade=False):
 db=sqlite3.connect(":memory:",isolation_level=None); db.row_factory=sqlite3.Row
 if upgrade: apply(db,MIGRATIONS[:2]); apply(db,MIGRATIONS[2:])
 else: apply(db,MIGRATIONS)
 return db
def fixture():
 db=database(True)
 db.execute("INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",(ACTOR,"synthetic-subject","synthetic@example.invalid","Synthetic UL","ACTIVE",NOW,NOW))
 db.executemany("INSERT INTO units(id,code,name,status) VALUES(?,?,?,'ACTIVE')",[(UNIT_A,"SYN-A","Synthetic A"),(UNIT_B,"SYN-B","Synthetic B")])
 for member,unit,ref in [(MEMBER_A,UNIT_A,"SYN-01"),(MEMBER_B,UNIT_B,"SYN-02")]:
  db.execute("INSERT INTO members(id,employee_ref,display_name,status,joined_on,created_at,updated_at) VALUES(?,?,?,'ACTIVE','2026-01-01',?,?)",(member,ref,"Synthetic Member",NOW,NOW))
  db.execute("INSERT INTO member_unit_history VALUES(?,?,?,1,'2026-01-01',NULL,'MANUAL',?,?)",(f"unit-{ref}",member,unit,ACTOR,NOW))
 return db
def session(db,sid,member,unit): db.execute("INSERT INTO self_analysis_sessions VALUES(?,?,?,'EXPLORE','ACTIVE',1,?,NULL,?,?,?)",(sid,member,unit,NOW,ACTOR,NOW,NOW))
def question(db,qid,sid,pos=1): db.execute("INSERT INTO self_analysis_questions VALUES(?,?,?,'Synthetic question?',?,1,?,?,?)",(qid,sid,"VALUE",pos,ACTOR,NOW,NOW))
def entry(db,eid,sid,qid=None,conf="NORMAL",visibility="UL_AND_EXEC",policy="AI_SEND_ALLOWED"): db.execute("INSERT INTO self_analysis_entries VALUES(?,?,?,'ANSWERED','Synthetic response','MEMBER_STATEMENT',?,?,?,NULL,1,?,?,?)",(eid,sid,qid,conf,visibility,policy,ACTOR,NOW,NOW))
def audit(db,event,target,request): db.execute("INSERT INTO audit_events VALUES(?,?,?,?,'self_understanding',?,'SUCCEEDED','operation_succeeded',?,'{}')",(f"audit-{request}",event,NOW,ACTOR,target,request))
def atomic(db,statements):
 db.execute("BEGIN IMMEDIATE")
 try:
  for sql,args in statements: db.execute(sql,args)
  db.execute("COMMIT")
 except BaseException: db.execute("ROLLBACK"); raise
# Empty database and explicit I2 -> I3 upgrade.
database().close(); database(True).close()
db=fixture(); session(db,"session-a",MEMBER_A,UNIT_A); session(db,"session-b",MEMBER_B,UNIT_B); question(db,"question-a","session-a"); question(db,"question-b","session-b")
# Cross-session questions are rejected by DB, not merely API validation.
try: entry(db,"bad-cross-session","session-a","question-b"); raise AssertionError("cross-session question accepted")
except sqlite3.IntegrityError: pass
entry(db,"entry-a","session-a","question-a"); entry(db,"entry-b","session-b","question-b")
db.execute("INSERT INTO future_vision_versions VALUES('vision-a',?,?, 'FUTURE_VISION','Synthetic future','HYPOTHESIS','MEMBER_STATEMENT','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED',1,NULL,NULL,?,?)",(MEMBER_A,UNIT_A,ACTOR,NOW))
try: db.execute("INSERT INTO future_vision_evidence_refs VALUES('vision-a','entry-b')"); raise AssertionError("cross-owner evidence accepted")
except sqlite3.IntegrityError: pass
db.execute("INSERT INTO future_vision_evidence_refs VALUES('vision-a','entry-a')")
# Direct writes cannot mix confirmation/provenance, empty answers, or confidentiality policy.
invalid=[
 "INSERT INTO self_analysis_entries VALUES('bad-confirmed-unknown','session-a',NULL,'UNKNOWN',NULL,'MEMBER_CONFIRMED','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED','%s',1,'%s','%s','%s')"%(NOW,ACTOR,NOW,NOW),
 "INSERT INTO self_analysis_entries VALUES('bad-confirm','session-a',NULL,'ANSWERED','Synthetic','MEMBER_CONFIRMED','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED',NULL,1,'%s','%s','%s')"%(ACTOR,NOW,NOW),
 "INSERT INTO self_analysis_entries VALUES('bad-empty','session-a',NULL,'ANSWERED',NULL,'MEMBER_STATEMENT','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED',NULL,1,'%s','%s','%s')"%(ACTOR,NOW,NOW),
 "INSERT INTO self_analysis_entries VALUES('bad-secret','session-a',NULL,'ANSWERED','Synthetic','UL_OBSERVATION','CONFIDENTIAL','UL_AND_EXEC','AI_SEND_ALLOWED',NULL,1,'%s','%s','%s')"%(ACTOR,NOW,NOW),
 "INSERT INTO future_vision_versions VALUES('bad-vision','%s','%s','VALUE','Synthetic','MEMBER_CONFIRMED','AI_HYPOTHESIS','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED',1,NULL,'%s','%s','%s')"%(MEMBER_A,UNIT_A,NOW,ACTOR,NOW),
]
for sql in invalid:
 try: db.execute(sql); raise AssertionError("invalid provenance/state accepted")
 except sqlite3.IntegrityError: pass
# EXEC-style projection excludes both CONFIDENTIAL and UL_ONLY body rows.
entry(db,"entry-secret","session-a",None,"CONFIDENTIAL","UL_ONLY","AI_SEND_PROHIBITED")
rows=list(db.execute("SELECT e.response_text FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id WHERE s.member_id=? AND s.unit_id=? AND e.confidentiality='NORMAL' AND e.visibility='UL_AND_EXEC'",(MEMBER_A,UNIT_A)))
assert len(rows)==1 and rows[0][0]=="Synthetic response"
# Repository scope predicate conceals another Unit.
assert db.execute("SELECT m.id FROM members m JOIN member_unit_history h ON h.member_id=m.id WHERE m.id=? AND h.unit_id IN (?)",(MEMBER_B,UNIT_A)).fetchone() is None
# Version mismatch creates neither history nor success audit for session/question/entry.
operations=[
 [("INSERT INTO self_analysis_session_history SELECT 'hs','session-a',version,route_type,status,started_at,completed_at,?,? FROM self_analysis_sessions WHERE id='session-a' AND version=99",(ACTOR,NOW)),("UPDATE self_analysis_sessions SET status='ON_HOLD',version=version+1 WHERE id='session-a' AND version=99",()),("INSERT INTO audit_events SELECT 'as','SESSION',?,?,'self_understanding','session-a','SUCCEEDED','operation_succeeded','version-session','{}' WHERE changes()=1",(NOW,ACTOR))],
 [("INSERT INTO self_analysis_question_history SELECT 'hq','question-a',version,domain,prompt_text,position,?,? FROM self_analysis_questions WHERE id='question-a' AND version=99",(ACTOR,NOW)),("UPDATE self_analysis_questions SET prompt_text='Changed',version=version+1 WHERE id='question-a' AND version=99",()),("INSERT INTO audit_events SELECT 'aq','QUESTION',?,?,'self_understanding','question-a','SUCCEEDED','operation_succeeded','version-question','{}' WHERE changes()=1",(NOW,ACTOR))],
 [("INSERT INTO self_analysis_entry_history SELECT 'he','entry-a',version,response_status,response_text,provenance_type,confidentiality,visibility,ai_send_policy,confirmed_at,?,? FROM self_analysis_entries WHERE id='entry-a' AND version=99",(ACTOR,NOW)),("UPDATE self_analysis_entries SET response_text='Changed',version=version+1 WHERE id='entry-a' AND version=99",()),("INSERT INTO audit_events SELECT 'ae','ENTRY',?,?,'self_understanding','entry-a','SUCCEEDED','operation_succeeded','version-entry','{}' WHERE changes()=1",(NOW,ACTOR))],
]
for statements in operations: atomic(db,statements)
assert db.execute("SELECT count(*) FROM audit_events WHERE request_id LIKE 'version-%'").fetchone()[0]==0
assert db.execute("SELECT count(*) FROM self_analysis_session_history").fetchone()[0]==0
assert db.execute("SELECT count(*) FROM self_analysis_question_history").fetchone()[0]==0
assert db.execute("SELECT count(*) FROM self_analysis_entry_history").fetchone()[0]==0
# Audit failure rolls every create/update and history back. Audit metadata never contains a body.
for name,statements,probe in [
 ("session",[("INSERT INTO self_analysis_sessions VALUES('rollback-session',?,?, 'EXPLORE','ACTIVE',1,?,NULL,?,?,?)",(MEMBER_A,UNIT_A,NOW,ACTOR,NOW,NOW)),("INSERT INTO audit_events VALUES('x','SESSION',?,?,'self_understanding','rollback-session','SUCCEEDED','operation_succeeded','x','{}')",(NOW,ACTOR))],"SELECT count(*) FROM self_analysis_sessions WHERE id='rollback-session'"),
 ("question",[("INSERT INTO self_analysis_questions VALUES('rollback-question','session-a','VALUE','Synthetic?',2,1,?,?,?)",(ACTOR,NOW,NOW)),("INSERT INTO audit_events VALUES('x','QUESTION',?,?,'self_understanding','rollback-question','SUCCEEDED','operation_succeeded','x','{}')",(NOW,ACTOR))],"SELECT count(*) FROM self_analysis_questions WHERE id='rollback-question'"),
 ("entry",[("INSERT INTO self_analysis_entries VALUES('rollback-entry','session-a',NULL,'ANSWERED','Synthetic','MEMBER_STATEMENT','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED',NULL,1,?,?,?)",(ACTOR,NOW,NOW)),("INSERT INTO audit_events VALUES('x','ENTRY',?,?,'self_understanding','rollback-entry','SUCCEEDED','operation_succeeded','x','{}')",(NOW,ACTOR))],"SELECT count(*) FROM self_analysis_entries WHERE id='rollback-entry'"),
 ("vision",[("INSERT INTO future_vision_versions VALUES('rollback-vision',?,?,'VALUE','Synthetic','HYPOTHESIS','MEMBER_STATEMENT','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED',2,'vision-a',NULL,?,?)",(MEMBER_A,UNIT_A,ACTOR,NOW)),("INSERT INTO audit_events VALUES('x','VISION',?,?,'self_understanding','rollback-vision','SUCCEEDED','operation_succeeded','x','{}')",(NOW,ACTOR))],"SELECT count(*) FROM future_vision_versions WHERE id='rollback-vision'"),
]:
 db.execute("CREATE TRIGGER reject_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END")
 try: atomic(db,statements); raise AssertionError(name+" survived audit failure")
 except sqlite3.IntegrityError: pass
 db.execute("DROP TRIGGER reject_audit"); assert db.execute(probe).fetchone()[0]==0
assert all(row[0]=="{}" for row in db.execute("SELECT metadata_json FROM audit_events"))
print("I3 empty/upgrade, scope, confidentiality, integrity, locking, and rollback checks passed")
# Update/history/audit batches also roll back together when success audit insertion fails.
update_cases=[
 ("session-update",[("INSERT INTO self_analysis_session_history SELECT 'rollback-hs',id,version,route_type,status,started_at,completed_at,?,? FROM self_analysis_sessions WHERE id='session-a' AND version=1",(ACTOR,NOW)),("UPDATE self_analysis_sessions SET status='ON_HOLD',completed_at=NULL,version=2,updated_at=? WHERE id='session-a' AND version=1",(NOW,)),("INSERT INTO audit_events VALUES('x','SESSION_UPDATED',?,?,'self_understanding','session-a','SUCCEEDED','operation_succeeded','x','{}')",(NOW,ACTOR))],"SELECT status,version FROM self_analysis_sessions WHERE id='session-a'",("ACTIVE",1),"SELECT count(*) FROM self_analysis_session_history WHERE id='rollback-hs'"),
 ("question-update",[("INSERT INTO self_analysis_question_history SELECT 'rollback-hq',id,version,domain,prompt_text,position,?,? FROM self_analysis_questions WHERE id='question-a' AND version=1",(ACTOR,NOW)),("UPDATE self_analysis_questions SET prompt_text='Changed',version=2,updated_at=? WHERE id='question-a' AND version=1",(NOW,)),("INSERT INTO audit_events VALUES('x','QUESTION_UPDATED',?,?,'self_understanding','question-a','SUCCEEDED','operation_succeeded','x','{}')",(NOW,ACTOR))],"SELECT prompt_text,version FROM self_analysis_questions WHERE id='question-a'",("Synthetic question?",1),"SELECT count(*) FROM self_analysis_question_history WHERE id='rollback-hq'"),
 ("entry-update",[("INSERT INTO self_analysis_entry_history SELECT 'rollback-he',id,version,response_status,response_text,provenance_type,confidentiality,visibility,ai_send_policy,confirmed_at,?,? FROM self_analysis_entries WHERE id='entry-a' AND version=1",(ACTOR,NOW)),("UPDATE self_analysis_entries SET response_text='Changed',version=2,updated_at=? WHERE id='entry-a' AND version=1",(NOW,)),("INSERT INTO audit_events VALUES('x','ENTRY_UPDATED',?,?,'self_understanding','entry-a','SUCCEEDED','operation_succeeded','x','{}')",(NOW,ACTOR))],"SELECT response_text,version FROM self_analysis_entries WHERE id='entry-a'",("Synthetic response",1),"SELECT count(*) FROM self_analysis_entry_history WHERE id='rollback-he'"),
]
for name,statements,state_sql,expected,history_sql in update_cases:
 db.execute("CREATE TRIGGER reject_update_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END")
 try: atomic(db,statements); raise AssertionError(name+" survived audit failure")
 except sqlite3.IntegrityError: pass
 db.execute("DROP TRIGGER reject_update_audit")
 assert tuple(db.execute(state_sql).fetchone())==expected
 assert db.execute(history_sql).fetchone()[0]==0
print("I3 update/history/audit rollback checks passed")
