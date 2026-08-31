"""I7 fresh/upgrade, expiry, revocation, concurrency, and rollback checks."""

import sqlite3
from pathlib import Path

MIGRATIONS = sorted(Path("migrations").glob("*.sql"))
ACTOR = "00000000-0000-4000-8000-000000000010"
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
    connection.execute(
        "INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        (ACTOR, "ul-subject", "ul@example.invalid", "Synthetic UL", "ACTIVE", "2026-01-01", "2026-01-01"),
    )
    connection.execute("INSERT INTO units(id,code,name,status) VALUES(?,?,?,'ACTIVE')", (UNIT, "SYN", "Synthetic Unit"))
    connection.execute(
        "INSERT INTO members(id,employee_ref,display_name,status,joined_on,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        (MEMBER, "SYN-01", "Synthetic Member", "ACTIVE", "2026-01-01", "2026-01-01", "2026-01-01"),
    )
    return connection


def snapshot(connection: sqlite3.Connection, snapshot_id: str) -> None:
    connection.execute(
        "INSERT INTO share_snapshots(id,member_id,unit_id,r2_object_key,content_checksum,source_refs_json,exclusion_summary_json,created_by,idempotency_key,expires_at,created_at) VALUES(?,?,?,?,?,'[]','{}',?,?,?,?)",
        (snapshot_id, MEMBER, UNIT, f"share/{snapshot_id}.html", "checksum", ACTOR, f"key-{snapshot_id}", "2026-10-01", "2026-09-01"),
    )


database(False).close()
database(True).close()
connection = fixture()
snapshot(connection, "snapshot-a")

# Public attempts are aggregated in a fixed window instead of storing raw addresses.
for attempt in range(2):
    connection.execute(
        "INSERT INTO share_access_windows(client_hash,window_started_at,attempt_count,last_attempt_at) VALUES('client-hash','2026-09-01T00:00:00Z',1,?) ON CONFLICT(client_hash,window_started_at) DO UPDATE SET attempt_count=attempt_count+1,last_attempt_at=excluded.last_attempt_at",
        (f"2026-09-01T00:0{attempt}:00Z",),
    )
assert connection.execute(
    "SELECT attempt_count FROM share_access_windows WHERE client_hash='client-hash'"
).fetchone()[0] == 2

# Only 7-30 day tokens are accepted and raw tokens have no database column.
columns = {row[1] for row in connection.execute("PRAGMA table_info(share_tokens)")}
assert "raw_token" not in columns
for token_id, expiry in [("too-short", "2026-09-07"), ("too-long", "2026-10-02")]:
    try:
        connection.execute(
            "INSERT INTO share_tokens(id,snapshot_id,token_hash,expires_at,created_by,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?)",
            (token_id, "snapshot-a", f"hash-{token_id}", expiry, ACTOR, f"key-{token_id}", "2026-09-01"),
        )
        raise AssertionError("out-of-range token expiry was accepted")
    except sqlite3.IntegrityError:
        pass

connection.execute(
    "INSERT INTO share_tokens(id,snapshot_id,token_hash,expires_at,created_by,idempotency_key,created_at) VALUES('token-a','snapshot-a','hash-a','2026-09-08',?,'key-token-a','2026-09-01')",
    (ACTOR,),
)
try:
    connection.execute(
        "INSERT INTO share_tokens(id,snapshot_id,token_hash,expires_at,created_by,idempotency_key,created_at) VALUES('token-duplicate','snapshot-a','hash-duplicate','2026-09-08',?,'key-token-a','2026-09-01')",
        (ACTOR,),
    )
    raise AssertionError("duplicate token issuance was accepted")
except sqlite3.IntegrityError:
    pass
connection.execute("UPDATE share_tokens SET revoked_at='2026-09-02' WHERE id='token-a'")
try:
    connection.execute("UPDATE share_tokens SET revoked_at='2026-09-03' WHERE id='token-a'")
    raise AssertionError("revoked token changed revocation time")
except sqlite3.IntegrityError:
    pass

# Confirmation cannot be inferred from a view and must carry method, result, and member words.
try:
    connection.execute(
        "INSERT INTO share_confirmations(id,snapshot_id,method,result,member_words,confirmed_at,recorded_by,created_at) VALUES('confirmation-bad','snapshot-a','SHARED_HTML','APPROVED','viewed','2026-09-02',?,'2026-09-02')",
        (ACTOR,),
    )
    raise AssertionError("URL view became confirmation")
except sqlite3.IntegrityError:
    pass

connection.execute(
    "INSERT INTO share_confirmations(id,snapshot_id,method,result,member_words,confirmed_at,recorded_by,created_at) VALUES('confirmation-a','snapshot-a','IN_PERSON','APPROVED','本人の合意を記録','2026-09-02',?,'2026-09-02')",
    (ACTOR,),
)

# A stale mutation nonce cannot attach a token after another update wins.
connection.execute("UPDATE share_snapshots SET version=2,mutation_nonce='winner' WHERE id='snapshot-a' AND version=1")
inserted = connection.execute(
    "INSERT INTO share_tokens(id,snapshot_id,token_hash,expires_at,created_by,idempotency_key,created_at) SELECT 'stale-token',id,'stale-hash','2026-09-10',?,'key-stale','2026-09-02' FROM share_snapshots WHERE id='snapshot-a' AND version=2 AND mutation_nonce='loser'",
    (ACTOR,),
).rowcount
assert inserted == 0

# Failure after a CAS rolls back version, token, and audit together.
before = tuple(connection.execute("SELECT version,mutation_nonce FROM share_snapshots WHERE id='snapshot-a'").fetchone())
connection.execute("BEGIN IMMEDIATE")
try:
    connection.execute("UPDATE share_snapshots SET version=version+1,mutation_nonce='rollback' WHERE id='snapshot-a' AND version=2")
    connection.execute(
        "INSERT INTO share_tokens(id,snapshot_id,token_hash,expires_at,created_by,idempotency_key,created_at) SELECT 'rollback-token',id,'hash-a','2026-09-10',?,'key-rollback','2026-09-02' FROM share_snapshots WHERE id='snapshot-a' AND mutation_nonce='rollback'",
        (ACTOR,),
    )
    connection.execute("COMMIT")
    raise AssertionError("duplicate token hash committed")
except sqlite3.IntegrityError:
    connection.execute("ROLLBACK")
assert tuple(connection.execute("SELECT version,mutation_nonce FROM share_snapshots WHERE id='snapshot-a'").fetchone()) == before
assert connection.execute("SELECT count(*) FROM share_tokens WHERE id='rollback-token'").fetchone()[0] == 0

print("I7 fresh/upgrade, expiry, revocation, nonce, confirmation and rollback checks passed")
