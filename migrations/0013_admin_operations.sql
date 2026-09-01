PRAGMA foreign_keys = ON;

ALTER TABLE model_policies ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE model_policies ADD COLUMN updated_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

CREATE TABLE app_user_access_versions (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at TEXT NOT NULL
);
INSERT INTO app_user_access_versions(user_id,version,updated_at)
SELECT id,1,updated_at FROM app_users;

CREATE TABLE operational_settings (
  id TEXT PRIMARY KEY CHECK(id='global'),
  maintenance_mode INTEGER NOT NULL DEFAULT 0 CHECK(maintenance_mode IN (0,1)),
  ai_incident_disabled INTEGER NOT NULL DEFAULT 0 CHECK(ai_incident_disabled IN (0,1)),
  share_incident_disabled INTEGER NOT NULL DEFAULT 0 CHECK(share_incident_disabled IN (0,1)),
  mail_incident_disabled INTEGER NOT NULL DEFAULT 0 CHECK(mail_incident_disabled IN (0,1)),
  incident_reason TEXT NOT NULL DEFAULT '' CHECK(length(incident_reason)<=1000),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated_by TEXT REFERENCES app_users(id),
  updated_at TEXT NOT NULL
);
INSERT INTO operational_settings(id,updated_at) VALUES('global','1970-01-01T00:00:00.000Z');

CREATE TABLE retention_actions (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL CHECK(subject_type IN ('MEMBER','AI_SUGGESTION','AUDIT_EVENT','SHARE_TOKEN','BACKUP')),
  subject_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('ANONYMIZE','DELETE_EXPIRED')),
  due_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('CANDIDATE','APPROVED','EXECUTING','EXECUTED','FAILED','CANCELLED')),
  basis TEXT NOT NULL CHECK(length(trim(basis)) BETWEEN 1 AND 1000),
  preview_json TEXT NOT NULL,
  preview_hash TEXT NOT NULL,
  candidate_by TEXT NOT NULL REFERENCES app_users(id),
  approved_by TEXT REFERENCES app_users(id),
  approved_at TEXT,
  executed_by TEXT REFERENCES app_users(id),
  executed_at TEXT,
  result_json TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(subject_type,subject_id,action),
  CHECK((approved_by IS NULL AND approved_at IS NULL) OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
  CHECK((executed_by IS NULL AND executed_at IS NULL) OR (executed_by IS NOT NULL AND executed_at IS NOT NULL))
);

CREATE TABLE backup_exports (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK(environment IN ('LOCAL','PREVIEW','PRODUCTION')),
  status TEXT NOT NULL CHECK(status IN ('PENDING','READY','FAILED','EXPIRED')),
  schema_version TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  manifest_checksum TEXT,
  source_timestamp TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES app_users(id),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(created_by,idempotency_key),
  CHECK(julianday(expires_at)>=julianday(created_at,'+30 days'))
);

CREATE TABLE restore_exercises (
  id TEXT PRIMARY KEY,
  backup_export_id TEXT NOT NULL REFERENCES backup_exports(id),
  environment TEXT NOT NULL CHECK(environment IN ('LOCAL','PREVIEW')),
  status TEXT NOT NULL CHECK(status IN ('PASSED','FAILED')),
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  rpo_hours REAL NOT NULL CHECK(rpo_hours>=0),
  rto_minutes REAL NOT NULL CHECK(rto_minutes>=0),
  schema_verified INTEGER NOT NULL CHECK(schema_verified IN (0,1)),
  counts_verified INTEGER NOT NULL CHECK(counts_verified IN (0,1)),
  r2_refs_verified INTEGER NOT NULL CHECK(r2_refs_verified IN (0,1)),
  authorization_smoke_verified INTEGER NOT NULL CHECK(authorization_smoke_verified IN (0,1)),
  notes TEXT NOT NULL CHECK(length(notes)<=1000),
  executed_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE quota_snapshots (
  id TEXT PRIMARY KEY,
  environment TEXT NOT NULL CHECK(environment IN ('LOCAL','PREVIEW','PRODUCTION')),
  workers_percent REAL NOT NULL CHECK(workers_percent BETWEEN 0 AND 100),
  d1_percent REAL NOT NULL CHECK(d1_percent BETWEEN 0 AND 100),
  r2_percent REAL NOT NULL CHECK(r2_percent BETWEEN 0 AND 100),
  source TEXT NOT NULL CHECK(source IN ('SYNTHETIC','MANUAL_CLOUDFLARE')),
  recorded_by TEXT NOT NULL REFERENCES app_users(id),
  recorded_at TEXT NOT NULL
);

CREATE TABLE operational_job_runs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL CHECK(job_type IN ('RETENTION_SCAN','BACKUP_EXPORT','INTEGRITY_CHECK')),
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('SUCCEEDED','FAILED')),
  candidate_count INTEGER NOT NULL DEFAULT 0 CHECK(candidate_count>=0),
  error_code TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL
);

-- Retention preserves only non-linkable, cohort-level statistics.  No member,
-- Unit, employee, goal, action, or source-record identifier is retained here.
CREATE TABLE anonymous_member_statistics (
  bucket_month TEXT PRIMARY KEY CHECK(bucket_month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  anonymized_members INTEGER NOT NULL DEFAULT 0 CHECK(anonymized_members>=0),
  goal_count INTEGER NOT NULL DEFAULT 0 CHECK(goal_count>=0),
  progress_count INTEGER NOT NULL DEFAULT 0 CHECK(progress_count>=0),
  reflection_count INTEGER NOT NULL DEFAULT 0 CHECK(reflection_count>=0),
  indicator_count INTEGER NOT NULL DEFAULT 0 CHECK(indicator_count>=0),
  indicator_value_sum INTEGER NOT NULL DEFAULT 0 CHECK(indicator_value_sum>=0),
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_retention_actions_status_due ON retention_actions(status,due_at);
CREATE INDEX idx_backup_exports_status_time ON backup_exports(status,created_at);
CREATE INDEX idx_restore_exercises_time ON restore_exercises(created_at);
CREATE INDEX idx_quota_snapshots_time ON quota_snapshots(recorded_at);
CREATE INDEX idx_audit_events_time_type ON audit_events(occurred_at,event_type,outcome);

CREATE TRIGGER retention_two_person_execute BEFORE UPDATE OF status ON retention_actions
WHEN NEW.status='EXECUTING' BEGIN
  SELECT CASE WHEN OLD.status<>'APPROVED' OR OLD.approved_by IS NULL OR NEW.executed_by IS NULL OR OLD.approved_by=NEW.executed_by
    THEN RAISE(ABORT,'retention requires a different executing administrator') END;
  SELECT CASE WHEN NEW.preview_hash<>OLD.preview_hash THEN RAISE(ABORT,'retention preview changed') END;
END;

CREATE TRIGGER retention_terminal_one_way BEFORE UPDATE OF status ON retention_actions
WHEN OLD.status IN ('EXECUTED','CANCELLED') BEGIN
  SELECT RAISE(ABORT,'retention action is terminal');
END;

CREATE TRIGGER backup_ready_immutable BEFORE UPDATE ON backup_exports
WHEN OLD.status='READY' AND NEW.status<>'EXPIRED' BEGIN
  SELECT RAISE(ABORT,'ready backup manifest is immutable');
END;

CREATE TRIGGER restore_exercise_immutable_update BEFORE UPDATE ON restore_exercises BEGIN
  SELECT RAISE(ABORT,'restore exercise is immutable');
END;
CREATE TRIGGER restore_exercise_immutable_delete BEFORE DELETE ON restore_exercises BEGIN
  SELECT RAISE(ABORT,'restore exercise is immutable');
END;

CREATE TRIGGER audit_event_immutable_update BEFORE UPDATE ON audit_events
WHEN NOT EXISTS(
  SELECT 1 FROM retention_actions a
  WHERE a.subject_type='MEMBER' AND a.action='ANONYMIZE' AND a.status='EXECUTING'
    AND (
      (OLD.target_type='member' AND OLD.target_id=a.subject_id) OR
      (OLD.target_type='goal' AND EXISTS(SELECT 1 FROM goals g WHERE g.id=OLD.target_id AND g.member_id=a.subject_id)) OR
      (OLD.target_type='goal_version' AND EXISTS(SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE v.id=OLD.target_id AND g.member_id=a.subject_id)) OR
      (OLD.target_type='progress_entry' AND EXISTS(SELECT 1 FROM progress_entries p WHERE p.id=OLD.target_id AND p.member_id=a.subject_id)) OR
      (OLD.target_type='reflection' AND EXISTS(SELECT 1 FROM reflections r WHERE r.id=OLD.target_id AND r.member_id=a.subject_id)) OR
      (OLD.target_type='one_on_one' AND EXISTS(SELECT 1 FROM one_on_ones o WHERE o.id=OLD.target_id AND o.member_id=a.subject_id)) OR
      (OLD.target_type='one_on_one_entry' AND EXISTS(SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id WHERE e.id=OLD.target_id AND o.member_id=a.subject_id)) OR
      (OLD.target_type='self_understanding' AND (
        EXISTS(SELECT 1 FROM self_analysis_sessions s WHERE s.id=OLD.target_id AND s.member_id=a.subject_id) OR
        EXISTS(SELECT 1 FROM self_analysis_questions q JOIN self_analysis_sessions s ON s.id=q.session_id WHERE q.id=OLD.target_id AND s.member_id=a.subject_id) OR
        EXISTS(SELECT 1 FROM self_analysis_entries e JOIN self_analysis_sessions s ON s.id=e.session_id WHERE e.id=OLD.target_id AND s.member_id=a.subject_id) OR
        EXISTS(SELECT 1 FROM future_vision_versions v WHERE v.id=OLD.target_id AND v.member_id=a.subject_id)
      )) OR
      (OLD.target_type='ai_request' AND (OLD.target_id=a.subject_id OR EXISTS(SELECT 1 FROM ai_requests q WHERE q.id=OLD.target_id AND q.member_id=a.subject_id))) OR
      (OLD.target_type='ai_suggestion' AND EXISTS(SELECT 1 FROM ai_suggestions s JOIN ai_requests q ON q.id=s.request_id WHERE s.id=OLD.target_id AND q.member_id=a.subject_id)) OR
      (OLD.target_type='share_snapshot' AND EXISTS(SELECT 1 FROM share_snapshots s WHERE s.id=OLD.target_id AND s.member_id=a.subject_id)) OR
      (OLD.target_type='share_token' AND EXISTS(SELECT 1 FROM share_tokens t JOIN share_snapshots s ON s.id=t.snapshot_id WHERE t.id=OLD.target_id AND s.member_id=a.subject_id)) OR
      (OLD.target_type='reminder_rule' AND EXISTS(SELECT 1 FROM reminder_rules r WHERE r.id=OLD.target_id AND r.member_id=a.subject_id)) OR
      (OLD.target_type='notification' AND EXISTS(SELECT 1 FROM notifications n WHERE n.id=OLD.target_id AND n.member_id=a.subject_id)) OR
      (OLD.target_type='review' AND EXISTS(
        SELECT 1 FROM review_requests r WHERE r.id=OLD.target_id AND (
          (r.target_type='GOAL_VERSION' AND EXISTS(SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE v.id=r.target_id AND g.member_id=a.subject_id)) OR
          (r.target_type='PROGRESS_ENTRY' AND EXISTS(SELECT 1 FROM progress_entries p WHERE p.id=r.target_id AND p.member_id=a.subject_id)) OR
          (r.target_type='REFLECTION' AND EXISTS(SELECT 1 FROM reflections f WHERE f.id=r.target_id AND f.member_id=a.subject_id)) OR
          (r.target_type='ONE_ON_ONE_ENTRY' AND EXISTS(SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id WHERE e.id=r.target_id AND o.member_id=a.subject_id))
        )
      ))
    )
) BEGIN
  SELECT RAISE(ABORT,'audit event is append only');
END;
CREATE TRIGGER audit_event_immutable_delete BEFORE DELETE ON audit_events
WHEN NOT EXISTS(
  SELECT 1 FROM retention_actions a
  WHERE a.subject_type='AUDIT_EVENT' AND a.subject_id=OLD.id
    AND a.action='DELETE_EXPIRED' AND a.status='EXECUTING'
) BEGIN
  SELECT RAISE(ABORT,'audit event is append only');
END;

DROP TRIGGER goal_version_immutable;
CREATE TRIGGER goal_version_immutable BEFORE UPDATE ON goal_versions
WHEN OLD.status IN ('CONFIRMED','SUPERSEDED') AND NOT EXISTS(
  SELECT 1 FROM goals g JOIN retention_actions a ON a.subject_id=g.member_id
  WHERE g.id=OLD.goal_id AND a.subject_type='MEMBER' AND a.action='ANONYMIZE' AND a.status='EXECUTING'
) BEGIN
  SELECT RAISE(ABORT,'published goal version immutable');
END;

DROP TRIGGER goal_policy_link_immutable_update;
CREATE TRIGGER goal_policy_link_immutable_update BEFORE UPDATE ON goal_policy_links
WHEN NOT EXISTS(
  SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id
  JOIN retention_actions a ON a.subject_id=g.member_id
  WHERE v.id=OLD.goal_version_id AND a.subject_type='MEMBER'
    AND a.action='ANONYMIZE' AND a.status='EXECUTING'
) BEGIN
  SELECT RAISE(ABORT,'historic policy link immutable');
END;

DROP TRIGGER goal_policy_link_immutable_delete;
CREATE TRIGGER goal_policy_link_immutable_delete BEFORE DELETE ON goal_policy_links
WHEN NOT EXISTS(
  SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id
  JOIN retention_actions a ON a.subject_id=g.member_id
  WHERE v.id=OLD.goal_version_id AND a.subject_type='MEMBER'
    AND a.action='ANONYMIZE' AND a.status='EXECUTING'
) BEGIN
  SELECT RAISE(ABORT,'historic policy link immutable');
END;

DROP TRIGGER review_comment_immutable_update;
CREATE TRIGGER review_comment_immutable_update BEFORE UPDATE ON review_comments
WHEN NOT EXISTS(
  SELECT 1 FROM review_requests r JOIN retention_actions a
    ON a.subject_type='MEMBER' AND a.action='ANONYMIZE' AND a.status='EXECUTING'
  WHERE r.id=OLD.review_request_id AND (
    (r.target_type='GOAL_VERSION' AND EXISTS(
      SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id
      WHERE v.id=r.target_id AND g.member_id=a.subject_id
    )) OR
    (r.target_type='PROGRESS_ENTRY' AND EXISTS(
      SELECT 1 FROM progress_entries p WHERE p.id=r.target_id AND p.member_id=a.subject_id
    )) OR
    (r.target_type='REFLECTION' AND EXISTS(
      SELECT 1 FROM reflections f WHERE f.id=r.target_id AND f.member_id=a.subject_id
    )) OR
    (r.target_type='ONE_ON_ONE_ENTRY' AND EXISTS(
      SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id
      WHERE e.id=r.target_id AND o.member_id=a.subject_id
    ))
  )
) BEGIN
  SELECT RAISE(ABORT,'review comment immutable');
END;

DROP TRIGGER review_comment_immutable_delete;
CREATE TRIGGER review_comment_immutable_delete BEFORE DELETE ON review_comments
WHEN NOT EXISTS(
  SELECT 1 FROM review_requests r JOIN retention_actions a
    ON a.subject_type='MEMBER' AND a.action='ANONYMIZE' AND a.status='EXECUTING'
  WHERE r.id=OLD.review_request_id AND (
    (r.target_type='GOAL_VERSION' AND EXISTS(
      SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id
      WHERE v.id=r.target_id AND g.member_id=a.subject_id
    )) OR
    (r.target_type='PROGRESS_ENTRY' AND EXISTS(
      SELECT 1 FROM progress_entries p WHERE p.id=r.target_id AND p.member_id=a.subject_id
    )) OR
    (r.target_type='REFLECTION' AND EXISTS(
      SELECT 1 FROM reflections f WHERE f.id=r.target_id AND f.member_id=a.subject_id
    )) OR
    (r.target_type='ONE_ON_ONE_ENTRY' AND EXISTS(
      SELECT 1 FROM one_on_one_entries e JOIN one_on_ones o ON o.id=e.one_on_one_id
      WHERE e.id=r.target_id AND o.member_id=a.subject_id
    ))
  )
) BEGIN
  SELECT RAISE(ABORT,'review comment immutable');
END;

CREATE TRIGGER keep_last_active_system_admin_status BEFORE UPDATE OF status ON app_users
WHEN OLD.status='ACTIVE' AND NEW.status<>'ACTIVE' AND EXISTS(
  SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
  WHERE ur.user_id=OLD.id AND r.code='SYSTEM_ADMIN' AND ur.valid_to IS NULL
) BEGIN
  SELECT CASE WHEN (SELECT COUNT(DISTINCT u.id) FROM app_users u
    JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
    WHERE u.status='ACTIVE' AND r.code='SYSTEM_ADMIN' AND ur.valid_to IS NULL)<=1
  THEN RAISE(ABORT,'cannot disable last active system admin') END;
END;

CREATE TRIGGER keep_last_active_system_admin_role BEFORE UPDATE OF valid_to ON user_roles
WHEN OLD.valid_to IS NULL AND NEW.valid_to IS NOT NULL AND EXISTS(
  SELECT 1 FROM roles r WHERE r.id=OLD.role_id AND r.code='SYSTEM_ADMIN'
) BEGIN
  SELECT CASE WHEN (SELECT COUNT(DISTINCT u.id) FROM app_users u
    JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
    WHERE u.status='ACTIVE' AND r.code='SYSTEM_ADMIN' AND ur.valid_to IS NULL)<=1
  THEN RAISE(ABORT,'cannot revoke last active system admin') END;
END;
