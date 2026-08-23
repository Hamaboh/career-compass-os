"""SQLite-backed migration and atomic history integration checks.

D1 batch executes its statements as a transaction. These tests execute the same
statement sequence inside an explicit SQLite transaction and assert rollback on
constraint/trigger errors.
"""

import sqlite3
from pathlib import Path
from typing import Any, Callable

MIGRATIONS = sorted(Path("migrations").glob("*.sql"))
ACTOR = "00000000-0000-4000-8000-000000000010"
UNIT_A = "00000000-0000-4000-8000-000000000001"
UNIT_B = "00000000-0000-4000-8000-000000000002"
MEMBER = "00000000-0000-4000-8000-000000000020"


def apply(connection: sqlite3.Connection, migrations: list[Path]) -> None:
    for migration in migrations:
        connection.executescript(migration.read_text())
    assert list(connection.execute("PRAGMA foreign_key_check")) == []


def migrated(upgrade: bool = False) -> sqlite3.Connection:
    connection = sqlite3.connect(":memory:", isolation_level=None)
    connection.row_factory = sqlite3.Row
    if upgrade:
        apply(connection, MIGRATIONS[:1])
        apply(connection, MIGRATIONS[1:])
    else:
        apply(connection, MIGRATIONS)
    return connection


def fixture() -> sqlite3.Connection:
    connection = migrated(upgrade=True)
    connection.execute(
        "INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        (ACTOR, "subject", "synthetic@example.invalid", "Synthetic", "ACTIVE", "2026-01-01", "2026-01-01"),
    )
    connection.executemany(
        "INSERT INTO units(id,code,name,status) VALUES(?,?,?,?)",
        [(UNIT_A, "SYN-A", "Synthetic A", "ACTIVE"), (UNIT_B, "SYN-B", "Synthetic B", "ACTIVE")],
    )
    connection.execute(
        "INSERT INTO members(id,employee_ref,display_name,status,joined_on,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
        (MEMBER, "SYN-01", "Synthetic Member", "ACTIVE", "2026-01-01", "2026-01-01", "2026-01-01"),
    )
    connection.execute(
        "INSERT INTO member_unit_history VALUES(?,?,?,?,?,?,?,?,?)",
        ("primary-old", MEMBER, UNIT_A, 1, "2026-01-01", None, "MANUAL", ACTOR, "2026-01-01"),
    )
    connection.execute(
        "INSERT INTO member_status_history VALUES(?,?,?,?,?,?,?,?)",
        ("status-active", MEMBER, "ACTIVE", "2026-01-01", None, "JOINED", ACTOR, "2026-01-01"),
    )
    return connection


def transaction(connection: sqlite3.Connection, operation: Callable[[], Any]) -> Any:
    connection.execute("BEGIN IMMEDIATE")
    try:
        result = operation()
        connection.execute("COMMIT")
        return result
    except BaseException:
        connection.execute("ROLLBACK")
        raise


def add_unit(connection: sqlite3.Connection, history_id: str, unit_id: str, started_on: str, version: int, primary: int = 1) -> int:
    def statements() -> int:
        connection.execute(
            """UPDATE member_unit_history SET ended_on=?
               WHERE member_id=? AND is_primary=1 AND ended_on IS NULL
                 AND started_on<? AND ?=1
                 AND EXISTS (SELECT 1 FROM members WHERE id=? AND version=?)""",
            (started_on, MEMBER, started_on, primary, MEMBER, version),
        )
        inserted = connection.execute(
            """INSERT INTO member_unit_history(id,member_id,unit_id,is_primary,started_on,ended_on,source,decided_by,created_at)
               SELECT ?,m.id,?,?,?,?,?,?,? FROM members m WHERE m.id=? AND m.version=?""",
            (history_id, unit_id, primary, started_on, None, "MANUAL", ACTOR, started_on, MEMBER, version),
        ).rowcount
        connection.execute(
            """UPDATE members SET version=version+1,updated_at=?
               WHERE id=? AND version=?
                 AND EXISTS (SELECT 1 FROM member_unit_history WHERE id=?)""",
            (started_on, MEMBER, version, history_id),
        )
        return inserted

    return transaction(connection, statements)


def add_status(connection: sqlite3.Connection, history_id: str, status: str, started_on: str, version: int) -> int:
    def statements() -> int:
        connection.execute(
            """UPDATE member_status_history SET ended_on=?
               WHERE member_id=? AND ended_on IS NULL AND started_on<?
                 AND EXISTS (SELECT 1 FROM members WHERE id=? AND version=?)""",
            (started_on, MEMBER, started_on, MEMBER, version),
        )
        inserted = connection.execute(
            """INSERT INTO member_status_history(id,member_id,status,started_on,ended_on,reason_code,decided_by,created_at)
               SELECT ?,m.id,?,?,?,?,?,? FROM members m WHERE m.id=? AND m.version=?""",
            (history_id, status, started_on, None, f"SYN_{status}", ACTOR, started_on, MEMBER, version),
        ).rowcount
        connection.execute(
            """UPDATE members
               SET status=?,left_on=CASE WHEN ?='LEFT' THEN ? WHEN ?='ACTIVE' THEN NULL ELSE left_on END,
                   version=version+1,updated_at=?
               WHERE id=? AND version=?
                 AND EXISTS (SELECT 1 FROM member_status_history WHERE id=?)""",
            (status, status, started_on, status, started_on, MEMBER, version, history_id),
        )
        return inserted

    return transaction(connection, statements)


def snapshot(connection: sqlite3.Connection) -> tuple[list[tuple[Any, ...]], list[tuple[Any, ...]], tuple[Any, ...]]:
    units = [tuple(row) for row in connection.execute("SELECT id,unit_id,is_primary,started_on,ended_on FROM member_unit_history ORDER BY id")]
    statuses = [tuple(row) for row in connection.execute("SELECT id,status,started_on,ended_on FROM member_status_history ORDER BY id")]
    member = tuple(connection.execute("SELECT status,left_on,version,updated_at FROM members WHERE id=?", (MEMBER,)).fetchone())
    return units, statuses, member


# Empty DB and I1 -> I2 upgrade paths.
migrated().close()
migrated(upgrade=True).close()

# Strict database triggers reject standalone inserts that overlap an open period.
connection = fixture()
before = snapshot(connection)
try:
    connection.execute(
        "INSERT INTO member_unit_history VALUES(?,?,?,?,?,?,?,?,?)",
        ("standalone-primary", MEMBER, UNIT_B, 1, "2026-03-01", None, "MANUAL", ACTOR, "2026-03-01"),
    )
    raise AssertionError("standalone overlapping primary was accepted")
except sqlite3.IntegrityError:
    pass
try:
    connection.execute(
        "INSERT INTO member_status_history VALUES(?,?,?,?,?,?,?,?)",
        ("standalone-status", MEMBER, "LEFT", "2026-03-01", None, "SYN_LEFT", ACTOR, "2026-03-01"),
    )
    raise AssertionError("standalone overlapping status was accepted")
except sqlite3.IntegrityError:
    pass
assert snapshot(connection) == before

# Normal primary change applies insert, closure, and version as one unit.
connection = fixture()
assert add_unit(connection, "primary-new", UNIT_B, "2026-03-01", 1) == 1
assert tuple(connection.execute("SELECT ended_on FROM member_unit_history WHERE id='primary-old'").fetchone()) == ("2026-03-01",)
assert tuple(connection.execute("SELECT unit_id,ended_on FROM member_unit_history WHERE id='primary-new'").fetchone()) == (UNIT_B, None)
assert connection.execute("SELECT version FROM members WHERE id=?", (MEMBER,)).fetchone()[0] == 2

# Same-Unit primary replacement also closes exactly the prior primary.
connection = fixture()
assert add_unit(connection, "primary-same-unit", UNIT_A, "2026-03-01", 1) == 1
assert connection.execute("SELECT ended_on FROM member_unit_history WHERE id='primary-old'").fetchone()[0] == "2026-03-01"
assert connection.execute("SELECT ended_on FROM member_unit_history WHERE id='primary-same-unit'").fetchone()[0] is None

# A secondary assignment does not close or replace the primary assignment.
connection = fixture()
assert add_unit(connection, "secondary-new", UNIT_B, "2026-03-01", 1, primary=0) == 1
assert connection.execute("SELECT ended_on FROM member_unit_history WHERE id='primary-old'").fetchone()[0] is None
assert tuple(connection.execute("SELECT is_primary,ended_on FROM member_unit_history WHERE id='secondary-new'").fetchone()) == (0, None)
assert connection.execute("SELECT version FROM members WHERE id=?", (MEMBER,)).fetchone()[0] == 2

# Version mismatch inserts nothing and every aggregate/history value stays unchanged.
before = snapshot(connection)
assert add_unit(connection, "wrong-version", UNIT_A, "2026-04-01", 1, primary=0) == 0
assert snapshot(connection) == before

# A constraint failure after the leading close rolls the close back completely.
connection = fixture()
before = snapshot(connection)
try:
    add_unit(connection, "primary-old", UNIT_B, "2026-03-01", 1)
    raise AssertionError("duplicate primary ID was accepted")
except sqlite3.IntegrityError:
    pass
assert snapshot(connection) == before
assert connection.execute("SELECT ended_on FROM member_unit_history WHERE id='primary-old'").fetchone()[0] is None

# A status constraint failure after close leaves history and aggregates untouched.
connection = fixture()
before = snapshot(connection)
assert add_status(connection, "status-wrong-version", "LEFT", "2026-02-01", 9) == 0
assert snapshot(connection) == before
try:
    add_status(connection, "status-active", "LEFT", "2026-03-01", 1)
    raise AssertionError("duplicate status ID was accepted")
except sqlite3.IntegrityError:
    pass
assert snapshot(connection) == before

# Normal retirement then re-entry keeps history and member aggregates consistent.
assert add_status(connection, "status-left", "LEFT", "2026-03-01", 1) == 1
assert tuple(connection.execute("SELECT status,left_on,version FROM members WHERE id=?", (MEMBER,)).fetchone()) == ("LEFT", "2026-03-01", 2)
assert connection.execute("SELECT ended_on FROM member_status_history WHERE id='status-active'").fetchone()[0] == "2026-03-01"
assert add_status(connection, "status-returned", "ACTIVE", "2026-04-01", 2) == 1
assert tuple(connection.execute("SELECT status,left_on,version FROM members WHERE id=?", (MEMBER,)).fetchone()) == ("ACTIVE", None, 3)
assert connection.execute("SELECT ended_on FROM member_status_history WHERE id='status-left'").fetchone()[0] == "2026-04-01"
assert connection.execute("SELECT ended_on FROM member_status_history WHERE id='status-returned'").fetchone()[0] is None

print("empty, I1-upgrade, and atomic history integration checks passed")
