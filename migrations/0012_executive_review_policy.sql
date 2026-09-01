PRAGMA foreign_keys = ON;

CREATE TABLE policy_documents (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('INDIVIDUAL_EVALUATION','UNIT_LEADERS_MISSION')),
  source_name TEXT NOT NULL CHECK(length(trim(source_name)) BETWEEN 1 AND 200),
  source_ref TEXT NOT NULL DEFAULT '' CHECK(length(source_ref)<=1000),
  owner TEXT NOT NULL CHECK(length(trim(owner)) BETWEEN 1 AND 200),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','RETIRED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE policy_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES policy_documents(id),
  version_no TEXT NOT NULL CHECK(length(trim(version_no)) BETWEEN 1 AND 50),
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','RETIRED')),
  imported_by TEXT NOT NULL REFERENCES app_users(id),
  checksum TEXT NOT NULL CHECK(length(checksum)=64),
  created_at TEXT NOT NULL,
  CHECK(effective_to IS NULL OR effective_to>=effective_from),
  UNIQUE(document_id,version_no)
);

CREATE TABLE policy_items (
  id TEXT PRIMARY KEY,
  policy_version_id TEXT NOT NULL REFERENCES policy_versions(id),
  category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 100),
  code TEXT NOT NULL CHECK(length(trim(code)) BETWEEN 1 AND 100),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300),
  description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=6000),
  criteria_json TEXT NOT NULL DEFAULT '{}',
  draft INTEGER NOT NULL CHECK(draft IN (0,1)),
  created_at TEXT NOT NULL,
  CHECK((category='Management' AND draft=1) OR (category<>'Management' AND draft=0)),
  UNIQUE(policy_version_id,code)
);

CREATE TABLE goal_policy_links (
  id TEXT PRIMARY KEY,
  goal_version_id TEXT NOT NULL REFERENCES goal_versions(id),
  policy_item_id TEXT NOT NULL REFERENCES policy_items(id),
  relevance_note TEXT NOT NULL DEFAULT '' CHECK(length(relevance_note)<=2000),
  linked_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  UNIQUE(goal_version_id,policy_item_id)
);

CREATE TRIGGER policy_version_immutable_update BEFORE UPDATE ON policy_versions
BEGIN SELECT RAISE(ABORT,'policy version immutable'); END;
CREATE TRIGGER policy_version_immutable_delete BEFORE DELETE ON policy_versions
BEGIN SELECT RAISE(ABORT,'policy version immutable'); END;
CREATE TRIGGER policy_item_immutable_update BEFORE UPDATE ON policy_items
BEGIN SELECT RAISE(ABORT,'policy item immutable'); END;
CREATE TRIGGER policy_item_immutable_delete BEFORE DELETE ON policy_items
BEGIN SELECT RAISE(ABORT,'policy item immutable'); END;
CREATE TRIGGER goal_policy_link_immutable_update BEFORE UPDATE ON goal_policy_links
BEGIN SELECT RAISE(ABORT,'historic policy link immutable'); END;
CREATE TRIGGER goal_policy_link_immutable_delete BEFORE DELETE ON goal_policy_links
BEGIN SELECT RAISE(ABORT,'historic policy link immutable'); END;
CREATE TRIGGER goal_policy_link_current_version BEFORE INSERT ON goal_policy_links
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM goal_versions gv
    JOIN goals g ON g.id=gv.goal_id AND g.current_version_id=gv.id
    JOIN policy_items pi ON pi.id=NEW.policy_item_id AND pi.draft=0
    JOIN policy_versions pv ON pv.id=pi.policy_version_id AND pv.status='ACTIVE'
    WHERE gv.id=NEW.goal_version_id
  ) THEN RAISE(ABORT,'policy link requires current goal and active non-draft item') END;
END;

CREATE TABLE review_requests (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK(target_type IN ('GOAL_VERSION','PROGRESS_ENTRY','REFLECTION','ONE_ON_ONE_ENTRY')),
  target_id TEXT NOT NULL,
  unit_id TEXT NOT NULL REFERENCES units(id),
  requested_by TEXT NOT NULL REFERENCES app_users(id),
  assigned_to TEXT REFERENCES app_users(id),
  status TEXT NOT NULL CHECK(status IN ('UNCONFIRMED','COMMENTING','RETURNED','UL_RESPONDED','CONFIRMED')),
  revision_no INTEGER NOT NULL CHECK(revision_no>0),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(target_type,target_id,revision_no)
);

CREATE TABLE review_comments (
  id TEXT PRIMARY KEY,
  review_request_id TEXT NOT NULL REFERENCES review_requests(id),
  author_id TEXT NOT NULL REFERENCES app_users(id),
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 4000),
  visibility TEXT NOT NULL DEFAULT 'EXEC_AND_UL' CHECK(visibility='EXEC_AND_UL'),
  disposition TEXT NOT NULL CHECK(disposition IN ('COMMENT','RETURN','CONFIRM','UL_RESPONSE')),
  created_at TEXT NOT NULL
);
CREATE TRIGGER review_comment_immutable_update BEFORE UPDATE ON review_comments
BEGIN SELECT RAISE(ABORT,'review comment immutable'); END;
CREATE TRIGGER review_comment_immutable_delete BEFORE DELETE ON review_comments
BEGIN SELECT RAISE(ABORT,'review comment immutable'); END;

CREATE TRIGGER review_target_visible_insert BEFORE INSERT ON review_requests
BEGIN
  SELECT CASE
    WHEN NEW.target_type='GOAL_VERSION' AND NOT EXISTS (
      SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id
      WHERE v.id=NEW.target_id AND g.unit_id=NEW.unit_id
        AND v.version_no=NEW.revision_no
        AND v.confidentiality='NORMAL' AND v.visibility='UL_AND_EXEC'
    ) THEN RAISE(ABORT,'review target not visible')
    WHEN NEW.target_type='PROGRESS_ENTRY' AND NOT EXISTS (
      SELECT 1 FROM progress_entries p JOIN goal_versions v ON v.id=p.goal_version_id WHERE p.id=NEW.target_id
        AND v.version_no=NEW.revision_no
        AND p.unit_id=NEW.unit_id AND p.confidentiality='NORMAL'
    ) THEN RAISE(ABORT,'review target not visible')
    WHEN NEW.target_type='REFLECTION' AND NOT EXISTS (
      SELECT 1 FROM reflections r JOIN goal_versions v ON v.id=r.goal_version_id WHERE r.id=NEW.target_id
        AND v.version_no=NEW.revision_no
        AND r.unit_id=NEW.unit_id AND r.confidentiality='NORMAL'
    ) THEN RAISE(ABORT,'review target not visible')
    WHEN NEW.target_type='ONE_ON_ONE_ENTRY' AND NOT EXISTS (
      SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id
      LEFT JOIN goal_versions v ON v.id=e.goal_version_id
      WHERE e.id=NEW.target_id AND o.unit_id=NEW.unit_id AND e.confidentiality='NORMAL'
        AND e.entry_type<>'RAW_NOTE'
        AND COALESCE(v.version_no,o.version)=NEW.revision_no
    ) THEN RAISE(ABORT,'review target not visible')
  END;
END;

CREATE TABLE holiday_calendars (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL CHECK(year BETWEEN 2000 AND 2200),
  version_no TEXT NOT NULL CHECK(length(trim(version_no)) BETWEEN 1 AND 50),
  status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','RETIRED')),
  checksum TEXT NOT NULL CHECK(length(checksum)=64),
  created_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  UNIQUE(year,version_no)
);
CREATE UNIQUE INDEX idx_holiday_calendar_active ON holiday_calendars(year) WHERE status='ACTIVE';
CREATE TABLE holidays (
  id TEXT PRIMARY KEY,
  calendar_id TEXT NOT NULL REFERENCES holiday_calendars(id),
  holiday_date TEXT NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 200),
  UNIQUE(calendar_id,holiday_date)
);
CREATE TRIGGER holiday_calendar_immutable_update BEFORE UPDATE ON holiday_calendars
WHEN OLD.status<>'DRAFT' BEGIN SELECT RAISE(ABORT,'published calendar immutable'); END;
CREATE TRIGGER holiday_requires_draft_calendar BEFORE INSERT ON holidays
WHEN NOT EXISTS (SELECT 1 FROM holiday_calendars c WHERE c.id=NEW.calendar_id AND c.status='DRAFT')
BEGIN SELECT RAISE(ABORT,'holidays require draft calendar'); END;
CREATE TRIGGER holiday_immutable_update BEFORE UPDATE ON holidays
BEGIN SELECT RAISE(ABORT,'holiday immutable'); END;
CREATE TRIGGER holiday_immutable_delete BEFORE DELETE ON holidays
BEGIN SELECT RAISE(ABORT,'holiday immutable'); END;

CREATE TABLE turnover_calculations (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  start_count INTEGER NOT NULL CHECK(start_count>=0),
  end_count INTEGER NOT NULL CHECK(end_count>=0),
  leaver_count INTEGER NOT NULL CHECK(leaver_count>=0),
  average_count REAL NOT NULL CHECK(average_count>=0),
  raw_rate REAL,
  display_rate REAL,
  calculable INTEGER NOT NULL CHECK(calculable IN (0,1)),
  is_eight_or_more INTEGER NOT NULL CHECK(is_eight_or_more IN (0,1)),
  rule_version TEXT NOT NULL,
  calculated_by TEXT NOT NULL REFERENCES app_users(id),
  calculated_at TEXT NOT NULL,
  CHECK(period_end>=period_start),
  CHECK((calculable=0 AND average_count=0 AND raw_rate IS NULL AND display_rate IS NULL) OR
        (calculable=1 AND average_count>0 AND raw_rate IS NOT NULL AND display_rate IS NOT NULL)),
  UNIQUE(unit_id,period_start,period_end,rule_version)
);
CREATE TRIGGER turnover_immutable_update BEFORE UPDATE ON turnover_calculations
BEGIN SELECT RAISE(ABORT,'turnover snapshot immutable'); END;
CREATE TRIGGER turnover_immutable_delete BEFORE DELETE ON turnover_calculations
BEGIN SELECT RAISE(ABORT,'turnover snapshot immutable'); END;

CREATE INDEX idx_policy_versions_document ON policy_versions(document_id,effective_from);
CREATE INDEX idx_policy_items_version ON policy_items(policy_version_id,category);
CREATE INDEX idx_goal_policy_links_goal ON goal_policy_links(goal_version_id);
CREATE INDEX idx_reviews_status ON review_requests(status,updated_at);
CREATE INDEX idx_reviews_unit ON review_requests(unit_id,updated_at);
CREATE INDEX idx_review_comments_request ON review_comments(review_request_id,created_at);
CREATE INDEX idx_turnover_unit_period ON turnover_calculations(unit_id,period_end);
