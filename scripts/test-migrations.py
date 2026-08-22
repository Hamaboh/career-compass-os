import sqlite3
from pathlib import Path
files=sorted(Path("migrations").glob("*.sql"))
def apply(conn,items):
 for p in items: conn.executescript(p.read_text())
 for row in conn.execute("PRAGMA foreign_key_check"): raise AssertionError(row)
# empty database path
c=sqlite3.connect(":memory:");apply(c,files)
# I1 upgrade path
u=sqlite3.connect(":memory:");apply(u,files[:1]);apply(u,files[1:])
# DB-enforced overlap, boundary adjacency is allowed
actor="00000000-0000-4000-8000-000000000010";unit="00000000-0000-4000-8000-000000000001";member="00000000-0000-4000-8000-000000000020"
u.execute("INSERT INTO app_users(id,access_subject,email_normalized,display_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",(actor,"subject","synthetic@example.invalid","Synthetic","ACTIVE","2026-01-01","2026-01-01"))
u.execute("INSERT INTO units(id,code,name,status) VALUES(?,?,?,?)",(unit,"SYN","Synthetic Unit","ACTIVE"))
u.execute("INSERT INTO members(id,employee_ref,display_name,status,joined_on,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",(member,"SYN-01","Synthetic Member","ACTIVE","2026-01-01","2026-01-01","2026-01-01"))
u.execute("INSERT INTO member_unit_history VALUES(?,?,?,?,?,?,?,?,?)",("h1",member,unit,1,"2026-01-01","2026-02-01","MANUAL",actor,"2026-01-01"))
u.execute("INSERT INTO member_unit_history VALUES(?,?,?,?,?,?,?,?,?)",("h2",member,unit,1,"2026-02-01",None,"MANUAL",actor,"2026-02-01"))
try:
 u.execute("INSERT INTO member_unit_history VALUES(?,?,?,?,?,?,?,?,?)",("h3",member,unit,1,"2026-01-15",None,"MANUAL",actor,"2026-01-15"))
 raise AssertionError("overlap accepted")
except sqlite3.IntegrityError: pass
print("empty and I1-upgrade migrations passed")
