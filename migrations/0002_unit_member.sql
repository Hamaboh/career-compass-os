PRAGMA foreign_keys = ON;

ALTER TABLE units ADD COLUMN type TEXT NOT NULL DEFAULT 'DELIVERY' CHECK(type IN ('DELIVERY','MANAGEMENT','OTHER'));
ALTER TABLE units ADD COLUMN valid_from TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE units ADD COLUMN valid_to TEXT;
ALTER TABLE units ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1);
ALTER TABLE units ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

CREATE TABLE members (
  id TEXT PRIMARY KEY,
  employee_ref TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','ON_LEAVE','LEFT','OUT_OF_SCOPE')),
  joined_on TEXT NOT NULL,
  left_on TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(length(trim(display_name)) BETWEEN 1 AND 100),
  CHECK(length(trim(employee_ref)) BETWEEN 1 AND 100),
  CHECK(left_on IS NULL OR left_on >= joined_on)
);

CREATE TABLE member_unit_history (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  is_primary INTEGER NOT NULL CHECK(is_primary IN (0,1)),
  started_on TEXT NOT NULL,
  ended_on TEXT,
  source TEXT NOT NULL CHECK(source IN ('MANUAL','IMPORT','MAINTENANCE')),
  decided_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  CHECK(ended_on IS NULL OR ended_on > started_on),
  UNIQUE(member_id,unit_id,started_on)
);

CREATE TABLE member_status_history (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','ON_LEAVE','LEFT','OUT_OF_SCOPE')),
  started_on TEXT NOT NULL,
  ended_on TEXT,
  reason_code TEXT NOT NULL,
  decided_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  CHECK(ended_on IS NULL OR ended_on > started_on),
  UNIQUE(member_id,started_on)
);

CREATE INDEX idx_members_status ON members(status,id);
CREATE INDEX idx_member_unit_history_unit_period ON member_unit_history(unit_id,started_on,ended_on);
CREATE INDEX idx_member_unit_history_member_period ON member_unit_history(member_id,started_on,ended_on);
CREATE INDEX idx_member_status_history_member_period ON member_status_history(member_id,started_on,ended_on);

CREATE TRIGGER member_primary_period_no_overlap_insert
BEFORE INSERT ON member_unit_history WHEN NEW.is_primary=1
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM member_unit_history h WHERE h.member_id=NEW.member_id AND h.is_primary=1
      AND h.started_on < COALESCE(NEW.ended_on,'9999-12-31')
      AND NEW.started_on < COALESCE(h.ended_on,'9999-12-31')
  ) THEN RAISE(ABORT,'member primary period conflict') END;
END;

CREATE TRIGGER member_unit_period_no_overlap_insert
BEFORE INSERT ON member_unit_history
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM member_unit_history h WHERE h.member_id=NEW.member_id AND h.unit_id=NEW.unit_id
      AND h.started_on < COALESCE(NEW.ended_on,'9999-12-31')
      AND NEW.started_on < COALESCE(h.ended_on,'9999-12-31')
  ) THEN RAISE(ABORT,'member unit period conflict') END;
END;

CREATE TRIGGER member_status_period_no_overlap_insert
BEFORE INSERT ON member_status_history
BEGIN
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM member_status_history h WHERE h.member_id=NEW.member_id
      AND h.started_on < COALESCE(NEW.ended_on,'9999-12-31')
      AND NEW.started_on < COALESCE(h.ended_on,'9999-12-31')
  ) THEN RAISE(ABORT,'member status period conflict') END;
END;
