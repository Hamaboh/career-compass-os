PRAGMA foreign_keys = ON;

-- A revision guard turns a failed compare-and-swap into a database error.
-- D1 batch is transactional, so the trigger abort rolls back every statement
-- in the losing batch, including versions, supersession and audit rows.
CREATE TABLE goal_revision_guards (
  goal_id TEXT PRIMARY KEY REFERENCES goals(id),
  expected_version INTEGER NOT NULL,
  expected_current_version_id TEXT NOT NULL REFERENCES goal_versions(id),
  proposed_version_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TRIGGER goal_revision_guard_cas BEFORE INSERT ON goal_revision_guards
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM goals g
    WHERE g.id=NEW.goal_id
      AND g.version=NEW.expected_version
      AND g.current_version_id=NEW.expected_current_version_id
  ) THEN RAISE(ABORT,'goal revision version conflict') END;
END;
