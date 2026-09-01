#!/usr/bin/env python3
import glob
import json
import os
import sqlite3
import subprocess
import tempfile
import time
from datetime import datetime, timezone

MIGRATIONS = sorted(glob.glob("migrations/*.sql"))


def fresh():
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys=ON")
    for migration in MIGRATIONS:
        connection.executescript(open(migration, encoding="utf-8").read())
    return connection


db = fresh()
now = "2026-09-01T00:00:00.000Z"
admin_a = "admin-a"
admin_b = "admin-b"
executive = "executive-a"
ul = "ul-a"
unit_a = "00000000-0000-4000-8000-000000000001"
unit_b = "00000000-0000-4000-8000-000000000002"

for actor in (admin_a, admin_b, executive, ul):
    db.execute(
        "INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?, 'ACTIVE',?,?)",
        (actor, f"subject-{actor}", f"{actor}@example.invalid", f"Synthetic {actor}", now, now),
    )
    db.execute(
        "INSERT INTO app_user_access_versions(user_id,version,updated_at) VALUES(?,1,?)",
        (actor, now),
    )
db.executemany(
    "INSERT INTO units(id,code,name,status,type,valid_from,version,updated_at) VALUES(?,?,?,'ACTIVE','DELIVERY','2026-01-01',1,?)",
    ((unit_a, "A", "Synthetic A", now), (unit_b, "B", "Synthetic B", now)),
)
for actor in (admin_a, admin_b):
    db.execute(
        "INSERT INTO user_roles(id,user_id,role_id,valid_from,granted_by) VALUES(?,?, 'role_system_admin',?,?)",
        (f"role-{actor}", actor, now, admin_a),
    )
db.execute(
    "INSERT INTO user_roles(id,user_id,role_id,valid_from,granted_by) VALUES('role-exec',?,'role_executive',?,?)",
    (executive, now, admin_a),
)
db.execute(
    "INSERT INTO user_roles(id,user_id,role_id,valid_from,granted_by) VALUES('role-ul',?,'role_ul',?,?)",
    (ul, now, admin_a),
)
db.execute(
    "INSERT INTO user_unit_scopes(id,user_id,unit_id,valid_from,granted_by) VALUES('scope-ul',?,?,?,?)",
    (ul, unit_a, now, admin_a),
)

# The last active SYSTEM_ADMIN cannot be disabled or revoked.
db.execute("UPDATE app_users SET status='SUSPENDED' WHERE id=?", (admin_a,))
try:
    db.execute("UPDATE app_users SET status='SUSPENDED' WHERE id=?", (admin_b,))
    raise AssertionError("last active SYSTEM_ADMIN was disabled")
except sqlite3.IntegrityError:
    pass
db.execute("UPDATE app_users SET status='ACTIVE' WHERE id=?", (admin_a,))

# Audit is append-only and cannot be shortened before the three-year policy job.
db.execute(
    "INSERT INTO audit_events VALUES('audit-old','SYNTHETIC','2023-08-31T00:00:00.000Z',?,'member','member-old','SUCCEEDED','safe','request-old','{}')",
    (admin_a,),
)
for statement in (
    "UPDATE audit_events SET outcome='DENIED' WHERE id='audit-old'",
    "DELETE FROM audit_events WHERE id='audit-old'",
):
    try:
        db.execute(statement)
        raise AssertionError("append-only audit changed")
    except sqlite3.IntegrityError:
        pass

# Audit deletion is possible only after a three-year candidate, preview and two-person approval.
audit_due = db.execute(
    "SELECT id FROM audit_events WHERE datetime(occurred_at)<=datetime(?,'-3 years')",
    (now,),
).fetchall()
assert audit_due == [("audit-old",)]
db.execute(
    "INSERT INTO retention_actions(id,subject_type,subject_id,action,due_at,status,basis,preview_json,preview_hash,candidate_by,version,created_at,updated_at) VALUES('retention-audit','AUDIT_EVENT','audit-old','DELETE_EXPIRED',?,'CANDIDATE','three years','{}',?,?,1,?,?)",
    (now, "b" * 64, admin_a, now, now),
)
db.execute(
    "UPDATE retention_actions SET status='APPROVED',approved_by=?,approved_at=?,version=2 WHERE id='retention-audit'",
    (admin_a, now),
)
db.execute(
    "UPDATE retention_actions SET status='EXECUTING',executed_by=?,executed_at=?,version=3 WHERE id='retention-audit'",
    (admin_b, now),
)
db.execute("DELETE FROM audit_events WHERE id='audit-old'")
db.execute(
    "UPDATE retention_actions SET status='EXECUTED',result_json='{}',updated_at=? WHERE id='retention-audit'",
    (now,),
)
assert db.execute("SELECT id FROM audit_events WHERE id='audit-old'").fetchone() is None

# Only a Member past the one-year boundary is a retention candidate.
for member_id, left_on in (("member-due", "2025-08-31"), ("member-new", "2026-08-31")):
    db.execute(
        "INSERT INTO members(id,employee_ref,display_name,status,joined_on,left_on,version,created_at,updated_at) VALUES(?,?,?,'LEFT','2024-01-01',?,1,?,?)",
        (member_id, f"ref-{member_id}", f"Synthetic {member_id}", left_on, now, now),
    )
due = db.execute(
    "SELECT id FROM members WHERE status IN ('LEFT','OUT_OF_SCOPE') AND left_on IS NOT NULL AND date(left_on)<=date(?,'-1 year')",
    (now,),
).fetchall()
assert due == [("member-due",)]
db.execute(
    "INSERT INTO member_unit_history(id,member_id,unit_id,is_primary,started_on,source,decided_by,created_at) VALUES('history-due','member-due',?,1,'2024-01-01','MANUAL',?,?)",
    (unit_a, admin_a, now),
)
db.execute(
    "INSERT INTO self_analysis_sessions(id,member_id,unit_id,route_type,status,version,started_at,created_by,created_at,updated_at) VALUES('session-due','member-due',?,'EXPLORE','ACTIVE',1,?,?,?,?)",
    (unit_a, now, admin_a, now, now),
)
db.execute(
    "INSERT INTO self_analysis_entries(id,session_id,response_status,response_text,provenance_type,confidentiality,visibility,ai_send_policy,version,created_by,created_at,updated_at) VALUES('entry-answered','session-due','ANSWERED','Synthetic personal text','MEMBER_STATEMENT','NORMAL','UL_AND_EXEC','AI_SEND_PROHIBITED',1,?,?,?)",
    (admin_a, now, now),
)
db.execute(
    "INSERT INTO self_analysis_entries(id,session_id,response_status,response_text,provenance_type,confidentiality,visibility,ai_send_policy,version,created_by,created_at,updated_at) VALUES('entry-unanswered','session-due','UNANSWERED',NULL,'UL_OBSERVATION','NORMAL','UL_AND_EXEC','AI_SEND_PROHIBITED',1,?,?,?)",
    (admin_a, now, now),
)
db.execute(
    "INSERT INTO goals(id,member_id,unit_id,lifecycle_status,owner_type,version,created_by,created_at,updated_at) VALUES('goal-due','member-due',?,'DRAFT','MEMBER',1,?,?,?)",
    (unit_a, admin_a, now, now),
)
db.execute(
    "INSERT INTO goal_versions(id,goal_id,version_no,entry_route,title,description,success_criteria,status,provenance_type,confidentiality,visibility,ai_send_policy,created_by,created_at) VALUES('goal-version-due','goal-due',1,'EXPLORE','Synthetic personal goal','','Synthetic success','DRAFT','UL_OBSERVATION','NORMAL','UL_AND_EXEC','AI_SEND_PROHIBITED',?,?)",
    (admin_a, now),
)
db.execute("UPDATE goals SET current_version_id='goal-version-due' WHERE id='goal-due'")
db.execute(
    "INSERT INTO policy_documents VALUES('policy-due','INDIVIDUAL_EVALUATION','Synthetic','', 'Synthetic owner','ACTIVE',1,?,?,?)",
    (admin_a, now, now),
)
db.execute(
    "INSERT INTO policy_versions VALUES('policy-version-due','policy-due','1',? ,NULL,'ACTIVE',? ,?,?)",
    (now, admin_a, "c" * 64, now),
)
db.execute(
    "INSERT INTO policy_items VALUES('policy-item-due','policy-version-due','Goal','G1','Synthetic','','{}',0,?)",
    (now,),
)
db.execute(
    "INSERT INTO goal_policy_links VALUES('policy-link-due','goal-version-due','policy-item-due','Synthetic relevance',?,?)",
    (admin_a, now),
)
db.execute(
    "INSERT INTO review_requests VALUES('review-due','GOAL_VERSION','goal-version-due',?,?,?,'COMMENTING',1,1,?,?)",
    (unit_a, admin_a, executive, now, now),
)
db.execute(
    "INSERT INTO review_comments VALUES('comment-due','review-due',?,'Synthetic private comment','EXEC_AND_UL','COMMENT',?)",
    (executive, now),
)

preview = json.dumps({"memberId": "member-due", "irreversible": True}, separators=(",", ":"))
preview_hash = "a" * 64
db.execute(
    "INSERT INTO retention_actions(id,subject_type,subject_id,action,due_at,status,basis,preview_json,preview_hash,candidate_by,version,created_at,updated_at) VALUES('retention-a','MEMBER','member-due','ANONYMIZE',?,'CANDIDATE','one year',?,?,?,1,?,?)",
    (now, preview, preview_hash, admin_a, now, now),
)
try:
    db.execute(
        "UPDATE retention_actions SET status='EXECUTING',executed_by=?,executed_at=? WHERE id='retention-a'",
        (admin_b, now),
    )
    raise AssertionError("retention skipped approval")
except sqlite3.IntegrityError:
    pass

# Idempotency keys and optimistic versions reject duplicate and stale work.
db.execute(
    "INSERT INTO operational_job_runs(id,job_type,dedupe_key,status,candidate_count,started_at,completed_at) VALUES('job-a','RETENTION_SCAN','retention:admin-a:dedupe-key','SUCCEEDED',1,?,?)",
    (now, now),
)
try:
    db.execute(
        "INSERT INTO operational_job_runs(id,job_type,dedupe_key,status,candidate_count,started_at,completed_at) VALUES('job-b','RETENTION_SCAN','retention:admin-a:dedupe-key','SUCCEEDED',1,?,?)",
        (now, now),
    )
    raise AssertionError("duplicate operational job was accepted")
except sqlite3.IntegrityError:
    pass
changed = db.execute(
    "UPDATE app_user_access_versions SET version=version+1 WHERE user_id=? AND version=?",
    (ul, 99),
).rowcount
assert changed == 0
db.execute(
    "UPDATE retention_actions SET status='APPROVED',approved_by=?,approved_at=?,version=2 WHERE id='retention-a'",
    (admin_a, now),
)
try:
    db.execute(
        "UPDATE retention_actions SET status='EXECUTING',executed_by=?,executed_at=? WHERE id='retention-a'",
        (admin_a, now),
    )
    raise AssertionError("same administrator approved and executed retention")
except sqlite3.IntegrityError:
    pass
db.execute(
    "UPDATE retention_actions SET status='EXECUTING',executed_by=?,executed_at=?,version=3 WHERE id='retention-a'",
    (admin_b, now),
)
db.execute(
    "INSERT INTO audit_events VALUES('audit-member','MEMBER_UPDATED',?,?, 'member','member-due','SUCCEEDED','safe','request-member','{}')",
    (now, admin_a),
)
# Retention removes all stable row-level linkage and keeps only a global monthly cohort.
db.execute(
    "UPDATE audit_events SET target_id='retired:unlinked',metadata_json='{}' WHERE id='audit-member'"
)
db.execute(
    """INSERT INTO anonymous_member_statistics(
      bucket_month,anonymized_members,goal_count,progress_count,reflection_count,indicator_count,indicator_value_sum,updated_at
    ) SELECT '2026-09',1,(SELECT COUNT(*) FROM goals WHERE member_id='member-due'),0,0,0,0,?
    WHERE EXISTS(SELECT 1 FROM members WHERE id='member-due')""",
    (now,),
)
db.execute("DELETE FROM review_comments WHERE id='comment-due'")
db.execute("DELETE FROM review_requests WHERE id='review-due'")
db.execute("DELETE FROM goal_policy_links WHERE id='policy-link-due'")
db.execute("DELETE FROM self_analysis_entries WHERE session_id='session-due'")
db.execute("DELETE FROM self_analysis_sessions WHERE id='session-due'")
db.execute("UPDATE goals SET current_version_id=NULL WHERE id='goal-due'")
db.execute("DELETE FROM goal_versions WHERE id='goal-version-due'")
db.execute("DELETE FROM goals WHERE id='goal-due'")
db.execute("DELETE FROM member_unit_history WHERE member_id='member-due'")
db.execute("DELETE FROM members WHERE id='member-due'")
db.execute(
    "UPDATE retention_actions SET status='EXECUTED',result_json='{}',updated_at=? WHERE id='retention-a'",
    (now,),
)
try:
    db.execute("UPDATE retention_actions SET status='FAILED' WHERE id='retention-a'")
    raise AssertionError("retention terminal state changed")
except sqlite3.IntegrityError:
    pass
assert db.execute("SELECT id FROM members WHERE id='member-due'").fetchone() is None
assert db.execute("SELECT id FROM self_analysis_entries WHERE id='entry-answered'").fetchone() is None
assert db.execute("SELECT id FROM goals WHERE id='goal-due'").fetchone() is None
assert db.execute("SELECT id FROM goal_policy_links WHERE id='policy-link-due'").fetchone() is None
assert db.execute("SELECT id FROM review_comments WHERE id='comment-due'").fetchone() is None
assert db.execute("SELECT target_id FROM audit_events WHERE id='audit-member'").fetchone() == (
    "retired:unlinked",
)
stat = db.execute(
    "SELECT anonymized_members,goal_count FROM anonymous_member_statistics WHERE bucket_month='2026-09'"
).fetchone()
assert stat == (1, 1)
columns = [row[1] for row in db.execute("PRAGMA table_info(anonymous_member_statistics)")]
assert not {"member_id", "unit_id", "employee_ref", "source_id"}.intersection(columns)

# Ready backup and restore evidence are immutable.
db.execute(
    "INSERT INTO backup_exports(id,environment,status,schema_version,object_key,manifest_checksum,source_timestamp,expires_at,created_by,idempotency_key,created_at) VALUES('backup-a','PREVIEW','READY','0013','backups/a','checksum',?,'2026-10-01T00:00:00.000Z',?,'backup-key',?)",
    (now, admin_a, now),
)
try:
    db.execute(
        "INSERT INTO backup_exports(id,environment,status,schema_version,object_key,manifest_checksum,source_timestamp,expires_at,created_by,idempotency_key,created_at) VALUES('backup-b','PREVIEW','READY','0013','backups/b','checksum',?,'2026-10-01T00:00:00.000Z',?,'backup-key',?)",
        (now, admin_a, now),
    )
    raise AssertionError("duplicate backup idempotency key was accepted")
except sqlite3.IntegrityError:
    pass
try:
    db.execute("UPDATE backup_exports SET manifest_checksum='changed' WHERE id='backup-a'")
    raise AssertionError("ready backup manifest changed")
except sqlite3.IntegrityError:
    pass
db.execute(
    "INSERT INTO restore_exercises VALUES('restore-a','backup-a','PREVIEW','PASSED',?,?,0,1,1,1,1,1,'synthetic',?,?)",
    (now, now, admin_b, now),
)
try:
    db.execute("UPDATE restore_exercises SET status='FAILED' WHERE id='restore-a'")
    raise AssertionError("restore evidence changed")
except sqlite3.IntegrityError:
    pass

# Business mutation and its success audit roll back together.
db.commit()
before = db.execute(
    "SELECT enabled,version FROM model_policies WHERE id='model_question_plan_fake'"
).fetchone()
db.execute(
    "CREATE TRIGGER reject_i9_audit BEFORE INSERT ON audit_events WHEN NEW.event_type='AI_POLICY_CHANGED' BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END"
)
try:
    with db:
        db.execute(
            "UPDATE model_policies SET enabled=0,version=version+1 WHERE id='model_question_plan_fake'"
        )
        db.execute(
            "INSERT INTO audit_events VALUES('audit-policy','AI_POLICY_CHANGED',?,?, 'model_policy','model_question_plan_fake','SUCCEEDED','safe','request-policy','{}')",
            (now, admin_a),
        )
    raise AssertionError("AI policy mutation survived audit failure")
except sqlite3.IntegrityError:
    pass
assert db.execute(
    "SELECT enabled,version FROM model_policies WHERE id='model_question_plan_fake'"
).fetchone() == before

# A real synthetic SQLite backup restores inside RPO/RTO and retains integrity.
source_started = datetime.now(timezone.utc)
before_users = db.execute("SELECT COUNT(*) FROM app_users").fetchone()[0]
handle = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
backup_path = handle.name
handle.close()
try:
    target = sqlite3.connect(backup_path)
    db.backup(target)
    target.close()
    db.execute(
        "INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES('after-backup','after','after@example.invalid','After','ACTIVE',?,?)",
        (now, now),
    )
    restored = sqlite3.connect(backup_path)
    restored.execute("PRAGMA foreign_keys=ON")
    assert restored.execute("SELECT COUNT(*) FROM app_users").fetchone()[0] == before_users
    assert list(restored.execute("PRAGMA foreign_key_check")) == []
    restored.close()
finally:
    os.unlink(backup_path)
elapsed_minutes = (datetime.now(timezone.utc) - source_started).total_seconds() / 60
assert elapsed_minutes < 1440

# The application V2 row artifact is independently restorable, not counts-only.
table_names = [
    row[0]
    for row in db.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
]
artifact_tables = {}
for table in table_names:
    cursor = db.execute(f'SELECT * FROM "{table}"')
    columns = [description[0] for description in cursor.description]
    artifact_tables[table] = [dict(zip(columns, row)) for row in cursor.fetchall()]
artifact = {
    "format": "CAREER_COMPASS_RECOVERABLE_BACKUP_V2",
    "schemaVersion": "0013",
    "sourceTimestamp": now,
    "counts": {table: len(rows) for table, rows in artifact_tables.items()},
    "tables": artifact_tables,
    "r2Keys": [],
}
artifact_handle = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
json.dump(artifact, artifact_handle)
artifact_handle.close()
restored_handle = tempfile.NamedTemporaryFile(suffix=".sqlite", delete=False)
restored_artifact_path = restored_handle.name
restored_handle.close()
os.unlink(restored_artifact_path)
try:
    subprocess.run(
        [
            "python3",
            "scripts/restore-backup-artifact.py",
            artifact_handle.name,
            restored_artifact_path,
        ],
        check=True,
    )
    restored = sqlite3.connect(restored_artifact_path)
    assert list(restored.execute("PRAGMA foreign_key_check")) == []
    assert restored.execute("SELECT COUNT(*) FROM app_users").fetchone()[0] == len(
        artifact_tables["app_users"]
    )
    restored.close()
finally:
    os.unlink(artifact_handle.name)
    if os.path.exists(restored_artifact_path):
        os.unlink(restored_artifact_path)
assert list(db.execute("PRAGMA foreign_key_check")) == []
print("Implementation 9 ACL, retention, idempotency, rollback and restore checks passed")
