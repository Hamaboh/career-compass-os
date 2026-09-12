#!/usr/bin/env python3
"""Pre-I10 synthetic capacity, actor-boundary, and integrity preparation."""

import glob
import sqlite3
import time


def fresh_database():
    database = sqlite3.connect(":memory:")
    database.execute("PRAGMA foreign_keys=ON")
    for path in sorted(glob.glob("migrations/*.sql")):
        with open(path, encoding="utf-8") as migration:
            database.executescript(migration.read())
    return database


db = fresh_database()
now = "2026-09-11T00:00:00.000Z"
units = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"]
db.executemany(
    "INSERT INTO units(id,code,name,status,type,valid_from,version,updated_at) VALUES(?,?,?,'ACTIVE','DELIVERY','2026-01-01',1,?)",
    [(units[0], "SYN-A", "Synthetic Unit A", now), (units[1], "SYN-B", "Synthetic Unit B", now)],
)

# The production-sized login population is seven ULs plus five upper-role users.
actors = [(f"ul-{number}", "role_ul") for number in range(7)] + [
    ("executive-1", "role_executive"),
    ("executive-2", "role_executive"),
    ("executive-3", "role_executive"),
    ("admin-1", "role_system_admin"),
    ("admin-2", "role_system_admin"),
]
for index, (actor_id, role_id) in enumerate(actors):
    db.execute(
        "INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?, 'ACTIVE',?,?)",
        (actor_id, f"synthetic-subject-{index}", f"actor-{index}@example.invalid", f"Synthetic Actor {index}", now, now),
    )
    db.execute(
        "INSERT INTO user_roles(id,user_id,role_id,valid_from,granted_by) VALUES(?,?,?,?,?)",
        (f"actor-role-{index}", actor_id, role_id, now, actor_id),
    )
    if role_id == "role_ul":
        db.execute(
            "INSERT INTO user_unit_scopes(id,user_id,unit_id,valid_from,granted_by) VALUES(?,?,?,?,?)",
            (f"actor-scope-{index}", actor_id, units[index % 2], now, actor_id),
        )

assert db.execute("SELECT count(*) FROM app_users").fetchone()[0] == 12
assert db.execute("SELECT count(*) FROM user_roles WHERE role_id='role_ul'").fetchone()[0] == 7
assert db.execute("SELECT count(*) FROM user_roles WHERE role_id IN ('role_executive','role_system_admin')").fetchone()[0] == 5

# MEMBER and EXCLUDED remain synthetic subject classes without an app user row.
for subject in ("synthetic-member-subject", "synthetic-excluded-subject"):
    assert db.execute("SELECT id FROM app_users WHERE access_subject=?", (subject,)).fetchone() is None

# Capacity fixture: ten Members per login user, split across two Units.
for number in range(120):
    member_id = f"synthetic-member-{number:03d}"
    unit_id = units[number % 2]
    db.execute(
        "INSERT INTO members(id,employee_ref,display_name,status,joined_on,version,created_at,updated_at) VALUES(?,?,?,'ACTIVE','2026-01-01',1,?,?)",
        (member_id, f"SYN-{number:03d}", f"Synthetic Member {number:03d}", now, now),
    )
    db.execute(
        "INSERT INTO member_unit_history(id,member_id,unit_id,is_primary,started_on,source,decided_by,created_at) VALUES(?,?,?,1,'2026-01-01','MANUAL',?,?)",
        (f"synthetic-history-{number:03d}", member_id, unit_id, f"ul-{number % 7}", now),
    )

started = time.perf_counter()
for _ in range(200):
    rows = db.execute(
        """SELECT m.id,m.display_name FROM members m
           JOIN member_unit_history h ON h.member_id=m.id
           WHERE h.unit_id=? AND h.is_primary=1 AND h.ended_on IS NULL
           ORDER BY m.id LIMIT 25""",
        (units[0],),
    ).fetchall()
    assert len(rows) == 25
elapsed_ms = (time.perf_counter() - started) * 1000
average_ms = elapsed_ms / 200
assert average_ms < 25, f"representative list query exceeded 25 ms: {average_ms:.3f} ms"

# Bound parameters treat SQL/XSS metacharacters as data, without changing row count.
hostile = "<script>alert(1)</script>' OR 1=1 --"
assert db.execute("SELECT count(*) FROM members WHERE display_name=?", (hostile,)).fetchone()[0] == 0
assert db.execute("PRAGMA foreign_key_check").fetchall() == []

page_count = db.execute("PRAGMA page_count").fetchone()[0]
page_size = db.execute("PRAGMA page_size").fetchone()[0]
database_bytes = page_count * page_size
assert database_bytes < 10 * 1024 * 1024

print(
    "synthetic acceptance preparation: actors=14 (12 login + MEMBER + EXCLUDED), "
    f"members=120, list_query_avg_ms={average_ms:.3f}, sqlite_bytes={database_bytes}, foreign_key_errors=0"
)
