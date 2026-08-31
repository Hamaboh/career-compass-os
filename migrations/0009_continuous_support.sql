PRAGMA foreign_keys = ON;

ALTER TABLE record_access_grants RENAME TO record_access_grants_i4;
CREATE TABLE record_access_grants (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('SELF_ANALYSIS_ENTRY','FUTURE_VISION_VERSION','GOAL_VERSION','ONE_ON_ONE_ENTRY','PROGRESS_ENTRY','REFLECTION')),
  resource_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES app_users(id),
  purpose TEXT NOT NULL CHECK(length(trim(purpose))>0),
  expires_at TEXT,
  granted_by TEXT NOT NULL REFERENCES app_users(id),
  granted_at TEXT NOT NULL,
  UNIQUE(resource_type,resource_id,actor_id)
);
INSERT INTO record_access_grants SELECT * FROM record_access_grants_i4;
DROP TABLE record_access_grants_i4;
CREATE INDEX idx_record_access_grants_lookup ON record_access_grants(resource_type,resource_id,actor_id,expires_at);

ALTER TABLE action_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0);

CREATE TABLE progress_entries (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  goal_version_id TEXT NOT NULL REFERENCES goal_versions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  state TEXT NOT NULL CHECK(state IN ('NOT_STARTED','IN_PROGRESS','PAUSED','COMPLETED','CANCELLED')),
  percent INTEGER CHECK(percent IS NULL OR percent BETWEEN 0 AND 100),
  self_rating INTEGER CHECK(self_rating IS NULL OR self_rating BETWEEN 0 AND 100),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=4000),
  blocker TEXT NOT NULL DEFAULT '' CHECK(length(blocker)<=2000),
  next_check_at TEXT,
  provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','MEMBER_CONFIRMED','UL_OBSERVATION')),
  confidentiality TEXT NOT NULL CHECK(confidentiality IN ('NORMAL','CONFIDENTIAL')),
  ai_send_policy TEXT NOT NULL CHECK(ai_send_policy IN ('AI_SEND_ALLOWED','AI_SEND_PROHIBITED')),
  recorded_by TEXT NOT NULL REFERENCES app_users(id),
  recorded_at TEXT NOT NULL,
  CHECK(confidentiality='NORMAL' OR ai_send_policy='AI_SEND_PROHIBITED')
);

CREATE TABLE reflections (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  goal_version_id TEXT NOT NULL REFERENCES goal_versions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  outcome TEXT NOT NULL DEFAULT '' CHECK(length(outcome)<=4000),
  learning TEXT NOT NULL DEFAULT '' CHECK(length(learning)<=4000),
  feeling TEXT NOT NULL DEFAULT '' CHECK(length(feeling)<=2000),
  next_choice TEXT NOT NULL CHECK(next_choice IN ('CONTINUE','REST','EXPLORE','NEXT_MILESTONE','REVISE','HOLD')),
  provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','MEMBER_CONFIRMED','UL_OBSERVATION')),
  confidentiality TEXT NOT NULL CHECK(confidentiality IN ('NORMAL','CONFIDENTIAL')),
  ai_send_policy TEXT NOT NULL CHECK(ai_send_policy IN ('AI_SEND_ALLOWED','AI_SEND_PROHIBITED')),
  recorded_by TEXT NOT NULL REFERENCES app_users(id),
  recorded_at TEXT NOT NULL,
  CHECK(period_end>=period_start),
  CHECK(confidentiality='NORMAL' OR ai_send_policy='AI_SEND_PROHIBITED')
);

CREATE TABLE goal_indicators (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  goal_version_id TEXT NOT NULL REFERENCES goal_versions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  metric_type TEXT NOT NULL CHECK(metric_type IN ('WHY_SATISFACTION','GOAL_SATISFACTION','DREAM_CONFIDENCE','SMART_QUALITY','ACHIEVABILITY','CURRENT_PROGRESS','MEMBER_SELF_RATING')),
  value INTEGER NOT NULL CHECK(value BETWEEN 0 AND 100),
  source_type TEXT NOT NULL CHECK(source_type IN ('MEMBER_SELF_REPORT','UL_REFERENCE','AI_REFERENCE')),
  basis_note TEXT NOT NULL DEFAULT '' CHECK(length(basis_note)<=2000),
  recorded_by TEXT NOT NULL REFERENCES app_users(id),
  recorded_at TEXT NOT NULL,
  CHECK(metric_type='SMART_QUALITY' OR source_type='MEMBER_SELF_REPORT')
);

CREATE TABLE one_on_ones (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  ul_user_id TEXT NOT NULL REFERENCES app_users(id),
  scheduled_at TEXT NOT NULL,
  held_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('SCHEDULED','HELD','CANCELLED','NEEDS_FOLLOW_UP')),
  theme TEXT NOT NULL DEFAULT '' CHECK(length(theme)<=1000),
  next_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE one_on_one_entries (
  id TEXT PRIMARY KEY,
  one_on_one_id TEXT NOT NULL REFERENCES one_on_ones(id),
  goal_version_id TEXT REFERENCES goal_versions(id),
  entry_type TEXT NOT NULL CHECK(entry_type IN ('MEMBER_STATEMENT','UL_OBSERVATION','AGREEMENT','UNCONFIRMED','NEXT_ACTION','UL_SUPPORT','RAW_NOTE')),
  body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 6000),
  provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','MEMBER_CONFIRMED','UL_OBSERVATION')),
  confidentiality TEXT NOT NULL CHECK(confidentiality IN ('NORMAL','CONFIDENTIAL')),
  ai_send_policy TEXT NOT NULL CHECK(ai_send_policy IN ('AI_SEND_ALLOWED','AI_SEND_PROHIBITED')),
  confirmed_with_member INTEGER NOT NULL DEFAULT 0 CHECK(confirmed_with_member IN (0,1)),
  confirmation_method TEXT CHECK(confirmation_method IS NULL OR confirmation_method IN ('IN_PERSON','VIDEO','PHONE','OTHER')),
  confirmed_at TEXT,
  member_confirmation_words TEXT CHECK(member_confirmation_words IS NULL OR length(trim(member_confirmation_words)) BETWEEN 1 AND 2000),
  created_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  CHECK(confidentiality='NORMAL' OR ai_send_policy='AI_SEND_PROHIBITED'),
  CHECK(
    (confirmed_with_member=0 AND confirmation_method IS NULL AND confirmed_at IS NULL AND member_confirmation_words IS NULL) OR
    (confirmed_with_member=1 AND provenance_type='MEMBER_CONFIRMED' AND confirmation_method IS NOT NULL AND confirmed_at IS NOT NULL AND member_confirmation_words IS NOT NULL)
  )
);

CREATE TABLE reminder_rules (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  subject_type TEXT NOT NULL CHECK(subject_type IN ('GOAL','ACTION','ONE_ON_ONE')),
  subject_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK(reminder_type IN ('ACTION_DUE','MIDPOINT_CHECK','REFLECTION','ONE_ON_ONE','SMART_RECHECK','GOAL_DUE','GOAL_UPDATE','UNANSWERED')),
  recipient_user_id TEXT NOT NULL REFERENCES app_users(id),
  cadence_days INTEGER CHECK(cadence_days IS NULL OR cadence_days BETWEEN 1 AND 365),
  next_run_at TEXT NOT NULL,
  grace_minutes INTEGER NOT NULL DEFAULT 0 CHECK(grace_minutes BETWEEN 0 AND 43200),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  stop_on_completion INTEGER NOT NULL DEFAULT 1 CHECK(stop_on_completion IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(
    (subject_type='ACTION' AND reminder_type='ACTION_DUE') OR
    (subject_type='ONE_ON_ONE' AND reminder_type IN ('ONE_ON_ONE','UNANSWERED')) OR
    (subject_type='GOAL' AND reminder_type IN ('MIDPOINT_CHECK','REFLECTION','SMART_RECHECK','GOAL_DUE','GOAL_UPDATE','UNANSWERED'))
  ),
  UNIQUE(subject_type,subject_id,reminder_type,recipient_user_id)
);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  recipient_user_id TEXT NOT NULL REFERENCES app_users(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','DELIVERED_FAKE','READ','SNOOZED','CANCELLED')),
  read_at TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type='NOTIFICATION_OUTBOX'),
  payload_ref TEXT NOT NULL REFERENCES notifications(id),
  status TEXT NOT NULL CHECK(status IN ('PENDING','SUCCEEDED','FAILED','DEAD')),
  dedupe_key TEXT NOT NULL UNIQUE,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  last_error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE notification_items (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL REFERENCES notifications(id),
  reminder_rule_id TEXT NOT NULL REFERENCES reminder_rules(id),
  type TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(notification_id,reminder_rule_id)
);

CREATE TABLE support_suggestions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id),
  goal_version_id TEXT NOT NULL REFERENCES goal_versions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  suggestion_type TEXT NOT NULL CHECK(suggestion_type IN ('NEXT_CHALLENGE','NEXT_ACTION','GOAL_CHANGE')),
  content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 2000),
  rationale TEXT NOT NULL CHECK(length(trim(rationale)) BETWEEN 1 AND 2000),
  source_type TEXT NOT NULL CHECK(source_type='AI_SUGGESTION'),
  provider_type TEXT NOT NULL CHECK(provider_type='DETERMINISTIC_FAKE'),
  proposal_status TEXT NOT NULL CHECK(proposal_status='PROPOSAL'),
  decision_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(decision_status IN ('PENDING','ACCEPTED','PARTIALLY_ACCEPTED','REJECTED','SUPERSEDED')),
  created_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL
);

CREATE TRIGGER progress_current_revision BEFORE INSERT ON progress_entries BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goals g WHERE g.id=NEW.goal_id AND g.current_version_id=NEW.goal_version_id AND g.member_id=NEW.member_id AND g.unit_id=NEW.unit_id)
    THEN RAISE(ABORT,'progress current revision mismatch') END;
END;
CREATE TRIGGER reflection_current_revision BEFORE INSERT ON reflections BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goals g WHERE g.id=NEW.goal_id AND g.current_version_id=NEW.goal_version_id AND g.member_id=NEW.member_id AND g.unit_id=NEW.unit_id)
    THEN RAISE(ABORT,'reflection current revision mismatch') END;
END;
CREATE TRIGGER indicator_current_revision BEFORE INSERT ON goal_indicators BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goals g WHERE g.id=NEW.goal_id AND g.current_version_id=NEW.goal_version_id AND g.member_id=NEW.member_id AND g.unit_id=NEW.unit_id)
    THEN RAISE(ABORT,'indicator current revision mismatch') END;
END;
CREATE TRIGGER suggestion_current_revision BEFORE INSERT ON support_suggestions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goals g WHERE g.id=NEW.goal_id AND g.current_version_id=NEW.goal_version_id AND g.member_id=NEW.member_id AND g.unit_id=NEW.unit_id)
    THEN RAISE(ABORT,'suggestion current revision mismatch') END;
END;
CREATE TRIGGER action_update_current_revision BEFORE UPDATE ON action_items BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goals g WHERE g.current_version_id=OLD.goal_version_id AND g.member_id=OLD.member_id)
    THEN RAISE(ABORT,'action current revision mismatch') END;
END;
CREATE TRIGGER one_on_one_entry_goal_revision BEFORE INSERT ON one_on_one_entries WHEN NEW.goal_version_id IS NOT NULL BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM one_on_ones o JOIN goals g ON g.member_id=o.member_id
    WHERE o.id=NEW.one_on_one_id AND g.current_version_id=NEW.goal_version_id
  ) THEN RAISE(ABORT,'one-on-one goal revision mismatch') END;
END;
CREATE TRIGGER reminder_subject_insert BEFORE INSERT ON reminder_rules BEGIN
  SELECT CASE WHEN
    (NEW.subject_type='GOAL' AND NOT EXISTS(SELECT 1 FROM goals g WHERE g.id=NEW.subject_id AND g.member_id=NEW.member_id AND g.unit_id=NEW.unit_id)) OR
    (NEW.subject_type='ACTION' AND NOT EXISTS(SELECT 1 FROM action_items a JOIN goals g ON g.current_version_id=a.goal_version_id WHERE a.id=NEW.subject_id AND a.member_id=NEW.member_id AND g.unit_id=NEW.unit_id)) OR
    (NEW.subject_type='ONE_ON_ONE' AND NOT EXISTS(SELECT 1 FROM one_on_ones o WHERE o.id=NEW.subject_id AND o.member_id=NEW.member_id AND o.unit_id=NEW.unit_id))
    THEN RAISE(ABORT,'reminder subject mismatch') END;
END;

CREATE INDEX idx_progress_goal_time ON progress_entries(goal_id,recorded_at);
CREATE INDEX idx_reflections_goal_time ON reflections(goal_id,period_end);
CREATE INDEX idx_indicators_goal_time ON goal_indicators(goal_id,recorded_at);
CREATE INDEX idx_one_on_ones_member_time ON one_on_ones(member_id,scheduled_at);
CREATE INDEX idx_one_on_one_entries_parent ON one_on_one_entries(one_on_one_id,created_at);
CREATE INDEX idx_reminders_due ON reminder_rules(enabled,next_run_at);
CREATE INDEX idx_notifications_recipient ON notifications(recipient_user_id,status,scheduled_at);
CREATE INDEX idx_jobs_due ON jobs(status,next_attempt_at);
CREATE INDEX idx_notification_items_parent ON notification_items(notification_id);
CREATE INDEX idx_suggestions_goal ON support_suggestions(goal_id,created_at);
