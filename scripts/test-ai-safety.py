"""Fresh/upgrade constraints and atomic AI state transition checks."""

import sqlite3
from pathlib import Path

MIGRATIONS = sorted(Path("migrations").glob("*.sql"))
ACTOR = "00000000-0000-4000-8000-000000000010"
OTHER = "00000000-0000-4000-8000-000000000011"
UNIT = "00000000-0000-4000-8000-000000000001"
MEMBER = "00000000-0000-4000-8000-000000000020"


def database(upgrade: bool) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", isolation_level=None)
    connection.execute("PRAGMA foreign_keys=ON")
    groups = [MIGRATIONS] if not upgrade else [MIGRATIONS[:-1], MIGRATIONS[-1:]]
    for group in groups:
        for migration in group:
            connection.executescript(migration.read_text())
    assert list(connection.execute("PRAGMA foreign_key_check")) == []
    return connection


def fixture() -> sqlite3.Connection:
    connection = database(True)
    connection.executemany(
        "INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        [
            (ACTOR, "ul-subject", "ul@example.invalid", "Synthetic UL", "ACTIVE", "2026-01-01", "2026-01-01"),
            (OTHER, "other-subject", "other@example.invalid", "Other UL", "ACTIVE", "2026-01-01", "2026-01-01"),
        ],
    )
    connection.execute("INSERT INTO units(id,code,name,status) VALUES(?,?,?,'ACTIVE')", (UNIT, "SYN", "Synthetic Unit"))
    connection.execute(
        "INSERT INTO members(id,employee_ref,display_name,status,joined_on,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        (MEMBER, "SYN-01", "Synthetic Member", "ACTIVE", "2026-01-01", "2026-01-01", "2026-01-01"),
    )
    return connection


def request(connection: sqlite3.Connection, request_id: str, status: str = "AWAITING_UL_APPROVAL") -> None:
    connection.execute(
        """INSERT INTO ai_requests(id,operation,actor_id,member_id,unit_id,purpose,status,context_hash,sanitized_context_cipher_ref,context_expires_at,input_refs_json,redaction_report_json,prompt_version_id,model_policy_id,schema_version,estimated_microunits,idempotency_key,execution_fingerprint,executive_visible,created_at,updated_at)
           VALUES(?,'QUESTION_PLAN',?,?,?,'synthetic purpose',?,'hash','ai-context/key','2026-09-02','[]','{}','prompt_question_plan_v1','model_question_plan_fake','1',100,?,?,1,'2026-09-01','2026-09-01')""",
        (request_id, ACTOR, MEMBER, UNIT, status, f"key-{request_id}", f"fingerprint-{request_id}"),
    )


database(False).close()
database(True).close()

connection = fixture()
request(connection, "request-approval")
try:
    connection.execute(
        "UPDATE ai_requests SET status='APPROVED',approved_by=?,approved_at='2026-09-01',approval_hash='hash' WHERE id='request-approval'",
        (OTHER,),
    )
    raise AssertionError("another actor approved the UL request")
except sqlite3.IntegrityError:
    pass

request(connection, "request-bypass")
try:
    connection.execute("UPDATE ai_requests SET status='SUCCEEDED' WHERE id='request-bypass'")
    raise AssertionError("an unapproved request bypassed the state machine")
except sqlite3.IntegrityError:
    pass
assert connection.execute("SELECT status FROM ai_requests WHERE id='request-bypass'").fetchone()[0] == "AWAITING_UL_APPROVAL"

try:
    connection.execute(
        "INSERT INTO ai_budget_ledger(id,month,request_id,unit_id,actor_id,operation,estimated_microunits,status,created_at,updated_at) VALUES('ledger-unapproved','2026-09','request-bypass',?,?, 'QUESTION_PLAN',100,'RESERVED','2026-09-01','2026-09-01')",
        (UNIT, ACTOR),
    )
    raise AssertionError("budget was reserved without approval")
except sqlite3.IntegrityError:
    pass
assert connection.execute("SELECT status FROM ai_requests WHERE id='request-approval'").fetchone()[0] == "AWAITING_UL_APPROVAL"

connection.execute(
    "UPDATE ai_requests SET status='APPROVED',approved_by=?,approved_at='2026-09-01',approval_hash='hash' WHERE id='request-approval'",
    (ACTOR,),
)
connection.execute("UPDATE ai_requests SET status='SENT' WHERE id='request-approval'")
connection.execute(
    "INSERT INTO ai_suggestions(id,request_id,suggestion_type,payload_json,rationale,status,source_refs_json,created_at) VALUES('suggestion-a','request-approval','NEXT_QUESTION','{\"content\":\"synthetic\"}','synthetic','PENDING','[]','2026-09-01')"
)
connection.execute("UPDATE ai_requests SET status='SUCCEEDED' WHERE id='request-approval'")
connection.execute("UPDATE ai_suggestions SET status='ACCEPTED',decision_by=?,decision_at='2026-09-01' WHERE id='suggestion-a'", (ACTOR,))
try:
    connection.execute("UPDATE ai_suggestions SET status='REJECTED' WHERE id='suggestion-a'")
    raise AssertionError("a decided suggestion changed decision")
except sqlite3.IntegrityError:
    pass

request(connection, "request-unsent")
try:
    connection.execute(
        "INSERT INTO ai_suggestions(id,request_id,suggestion_type,payload_json,rationale,status,source_refs_json,created_at) VALUES('suggestion-unsent','request-unsent','NEXT_QUESTION','{}','synthetic','PENDING','[]','2026-09-01')"
    )
    raise AssertionError("an unsent request produced a suggestion")
except sqlite3.IntegrityError:
    pass

# A failed reservation transaction leaves request, ledger, and audit unchanged.
request(connection, "request-rollback")
before = tuple(connection.execute("SELECT status,version FROM ai_requests WHERE id='request-rollback'").fetchone())
connection.execute("BEGIN IMMEDIATE")
try:
    connection.execute(
        "UPDATE ai_requests SET status='APPROVED',approved_by=?,approved_at='2026-09-01',approval_hash='hash' WHERE id='request-rollback'",
        (ACTOR,),
    )
    connection.execute(
        "INSERT INTO ai_budget_ledger(id,month,request_id,unit_id,actor_id,operation,estimated_microunits,status,created_at,updated_at) VALUES('ledger-a','2026-09','request-rollback',?,?, 'QUESTION_PLAN',100,'RESERVED','2026-09-01','2026-09-01')",
        (UNIT, ACTOR),
    )
    connection.execute("INSERT INTO ai_budget_ledger(id,month,request_id,unit_id,actor_id,operation,estimated_microunits,status,created_at,updated_at) VALUES('ledger-b','2026-09','request-rollback',?,?, 'QUESTION_PLAN',100,'RESERVED','2026-09-01','2026-09-01')", (UNIT, ACTOR))
    connection.execute("COMMIT")
    raise AssertionError("duplicate reservation committed")
except sqlite3.IntegrityError:
    connection.execute("ROLLBACK")
assert tuple(connection.execute("SELECT status,version FROM ai_requests WHERE id='request-rollback'").fetchone()) == before
assert connection.execute("SELECT count(*) FROM ai_budget_ledger WHERE request_id='request-rollback'").fetchone()[0] == 0

# The monthly 1,000 JPY cap blocks a new call without a reservation or proposal.
request(connection, "request-cap-used")
connection.execute(
    "UPDATE ai_requests SET status='APPROVED',approved_by=?,approved_at='2026-09-01',approval_hash='hash' WHERE id='request-cap-used'",
    (ACTOR,),
)
connection.execute(
    "INSERT INTO ai_budget_ledger(id,month,request_id,unit_id,actor_id,operation,estimated_microunits,status,created_at,updated_at) VALUES('ledger-cap','2026-09','request-cap-used',?,?,'QUESTION_PLAN',1000000000,'RESERVED','2026-09-01','2026-09-01')",
    (UNIT, ACTOR),
)
request(connection, "request-cap-candidate")
used = connection.execute(
    "SELECT coalesce(sum(CASE WHEN status='SETTLED' THEN actual_microunits ELSE estimated_microunits END),0) FROM ai_budget_ledger WHERE month='2026-09' AND status IN ('RESERVED','SETTLED')"
).fetchone()[0]
cap = connection.execute(
    "SELECT monthly_cap_microunits FROM model_policies WHERE id='model_question_plan_fake'"
).fetchone()[0]
estimate = connection.execute(
    "SELECT estimated_microunits FROM ai_requests WHERE id='request-cap-candidate'"
).fetchone()[0]
assert used + estimate > cap
connection.execute(
    "UPDATE ai_requests SET status='BLOCKED_BUDGET',error_code='AI_BUDGET_CAP' WHERE id='request-cap-candidate'"
)
assert connection.execute("SELECT status FROM ai_requests WHERE id='request-cap-candidate'").fetchone()[0] == "BLOCKED_BUDGET"
assert connection.execute("SELECT count(*) FROM ai_budget_ledger WHERE request_id='request-cap-candidate'").fetchone()[0] == 0
assert connection.execute("SELECT count(*) FROM ai_suggestions WHERE request_id='request-cap-candidate'").fetchone()[0] == 0

# Actor-scoped idempotency keys cannot reserve a second request.
try:
    connection.execute(
        "UPDATE ai_requests SET idempotency_key=(SELECT idempotency_key FROM ai_requests WHERE id='request-cap-used') WHERE id='request-cap-candidate'"
    )
    raise AssertionError("duplicate actor idempotency key was accepted")
except sqlite3.IntegrityError:
    pass

print("I6 fresh/upgrade, approval, proposal, idempotency and rollback checks passed")
