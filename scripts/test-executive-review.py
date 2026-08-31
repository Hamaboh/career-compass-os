#!/usr/bin/env python3
import glob
import sqlite3

MIGRATIONS = sorted(glob.glob("migrations/*.sql"))

def fresh():
    connection = sqlite3.connect(":memory:")
    connection.execute("PRAGMA foreign_keys=ON")
    for migration in MIGRATIONS:
        connection.executescript(open(migration, encoding="utf-8").read())
    return connection

db = fresh()
admin = "admin-synthetic"
executive = "executive-synthetic"
ul = "ul-synthetic"
unit = "unit-synthetic"
member = "member-synthetic"
for actor, subject in ((admin, "admin"), (executive, "executive"), (ul, "ul")):
    db.execute(
        "INSERT INTO app_users VALUES(?,?,?,?,'ACTIVE',NULL,'2026-01-01','2026-01-01')",
        (actor, subject, subject + "@example.invalid", subject),
    )
db.execute(
    "INSERT INTO units(id,code,name,status,type,valid_from,valid_to,version,updated_at) VALUES(?,?,?,'ACTIVE','DELIVERY','2026-01-01',NULL,1,'2026-01-01')",
    (unit, "SYN", "Synthetic Unit"),
)
db.execute(
    "INSERT INTO members VALUES(?,?,?,'ACTIVE','2026-01-01',NULL,1,'2026-01-01','2026-01-01')",
    (member, "SYN-1", "Synthetic Member"),
)
db.execute(
    "INSERT INTO member_unit_history VALUES(?,?,?,1,'2026-01-01',NULL,'MANUAL',?,'2026-01-01')",
    ("membership", member, unit, ul),
)
db.execute(
    "INSERT INTO member_status_history VALUES(?,?, 'ACTIVE','2026-01-01',NULL,'SYNTHETIC',?,'2026-01-01')",
    ("status", member, ul),
)
goal = "goal-synthetic"
goal_version = "goal-version-synthetic"
db.execute(
    "INSERT INTO goals VALUES(?,?,?,?,NULL,'DRAFT','MEMBER',1,?,?,?)",
    (goal, member, unit, None, ul, "2026-01-01", "2026-01-01"),
)
db.execute(
    "INSERT INTO goal_versions VALUES(?,?,1,'DIRECT_GOAL','Synthetic','','2026-12-31','Synthetic','monthly','DRAFT',NULL,'MEMBER_STATEMENT','NORMAL','UL_AND_EXEC','AI_SEND_ALLOWED',?,NULL,'2026-01-01')",
    (goal_version, goal, ul),
)
db.execute("UPDATE goals SET current_version_id=? WHERE id=?", (goal_version, goal))

document = "policy-document"
version1 = "policy-version-1"
item = "policy-item"
db.execute(
    "INSERT INTO policy_documents VALUES(?, 'UNIT_LEADERS_MISSION','Synthetic source','','Synthetic owner','ACTIVE',1,?,'2026-01-01','2026-01-01')",
    (document, admin),
)
db.execute(
    "INSERT INTO policy_versions VALUES(?,?, 'v1','2026-01-01',NULL,'ACTIVE',? ,?,'2026-01-01')",
    (version1, document, admin, "a" * 64),
)
db.execute(
    "INSERT INTO policy_items VALUES(?,?, 'Leader','L-1','Synthetic item','','{}',0,'2026-01-01')",
    (item, version1),
)
db.execute(
    "INSERT INTO goal_policy_links VALUES('policy-link',?,?, '',?,'2026-01-01')",
    (goal_version, item, ul),
)
db.execute(
    "INSERT INTO policy_versions VALUES('policy-version-2',?, 'v2','2026-07-01',NULL,'ACTIVE',? ,?,'2026-07-01')",
    (document, admin, "b" * 64),
)
assert db.execute(
    "SELECT policy_item_id FROM goal_policy_links WHERE id='policy-link'"
).fetchone()[0] == item

for statement in (
    "UPDATE policy_versions SET version_no='changed' WHERE id='policy-version-1'",
    "DELETE FROM policy_items WHERE id='policy-item'",
    "UPDATE goal_policy_links SET policy_item_id='other' WHERE id='policy-link'",
):
    try:
        db.execute(statement)
        raise AssertionError("immutable policy history changed")
    except sqlite3.IntegrityError:
        pass

try:
    db.execute(
        "INSERT INTO policy_items VALUES('bad-management',?,'Management','M-1','Bad','','{}',0,'2026-01-01')",
        (version1,),
    )
    raise AssertionError("Management item escaped DRAFT")
except sqlite3.IntegrityError:
    pass

try:
    db.execute(
        "INSERT INTO policy_items VALUES('management-draft',?,'Management','M-2','Draft','','{}',1,'2026-01-01')",
        (version1,),
    )
    db.execute(
        "INSERT INTO goal_policy_links VALUES('draft-link',?,'management-draft','',?,'2026-01-01')",
        (goal_version, ul),
    )
    raise AssertionError("DRAFT policy item linked to a goal")
except sqlite3.IntegrityError:
    pass

review = "review-synthetic"
db.execute(
    "INSERT INTO review_requests VALUES(?, 'GOAL_VERSION',?,?,?,?,'UNCONFIRMED',1,1,'2026-01-01','2026-01-01')",
    (review, goal_version, unit, ul, executive),
)
db.execute(
    "INSERT INTO review_comments VALUES('comment',?,?,?,'EXEC_AND_UL','RETURN','2026-01-01')",
    (review, executive, "Synthetic clarification"),
)
try:
    db.execute("UPDATE review_comments SET body='changed' WHERE id='comment'")
    raise AssertionError("review history changed")
except sqlite3.IntegrityError:
    pass

db.execute(
    "UPDATE goal_versions SET confidentiality='CONFIDENTIAL',visibility='UL_ONLY',ai_send_policy='AI_SEND_PROHIBITED' WHERE id=?",
    (goal_version,),
)
try:
    db.execute(
        "INSERT INTO review_requests VALUES('hidden-review','GOAL_VERSION',?,?,?,NULL,'UNCONFIRMED',2,1,'2026-01-02','2026-01-02')",
        (goal_version, unit, executive),
    )
    raise AssertionError("confidential target entered Executive review")
except sqlite3.IntegrityError:
    pass

db.execute(
    "INSERT INTO turnover_calculations VALUES('zero',?,'2026-01-01','2026-06-30',0,0,0,0,NULL,NULL,0,0,'rule-v1',?,'2026-07-01')",
    (unit, executive),
)
try:
    db.execute(
        "INSERT INTO turnover_calculations VALUES('bad-zero',?,'2026-01-01','2026-06-30',0,0,0,0,0,0,1,0,'rule-v2',?,'2026-07-01')",
        (unit, executive),
    )
    raise AssertionError("zero average was represented as 0 percent")
except sqlite3.IntegrityError:
    pass

# A failed success audit rolls the business row back in the same transaction.
before = db.execute("SELECT COUNT(*) FROM policy_documents").fetchone()[0]
db.execute(
    "CREATE TRIGGER reject_i8_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END"
)
try:
    with db:
        db.execute(
            "INSERT INTO policy_documents VALUES('rollback-doc','INDIVIDUAL_EVALUATION','Rollback','','Owner','ACTIVE',1,?,'2026-01-01','2026-01-01')",
            (admin,),
        )
        db.execute(
            "INSERT INTO audit_events VALUES('rollback-audit','POLICY','2026-01-01',?,'policy_document','rollback-doc','SUCCEEDED','operation_succeeded','request','{}')",
            (admin,),
        )
    raise AssertionError("business mutation survived audit failure")
except sqlite3.IntegrityError:
    pass
assert db.execute("SELECT COUNT(*) FROM policy_documents").fetchone()[0] == before
assert list(db.execute("PRAGMA foreign_key_check")) == []
print("Implementation 8 migration, immutability, ACL and rollback checks passed")
