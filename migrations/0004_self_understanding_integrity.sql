PRAGMA foreign_keys = ON;

CREATE TABLE self_analysis_session_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES self_analysis_sessions(id),
  version INTEGER NOT NULL,
  route_type TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  changed_by TEXT NOT NULL REFERENCES app_users(id),
  changed_at TEXT NOT NULL,
  UNIQUE(session_id, version)
);

CREATE TABLE self_analysis_question_history (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES self_analysis_questions(id),
  version INTEGER NOT NULL,
  domain TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  position INTEGER NOT NULL,
  changed_by TEXT NOT NULL REFERENCES app_users(id),
  changed_at TEXT NOT NULL,
  UNIQUE(question_id, version)
);

CREATE TRIGGER self_entry_question_same_session_insert
BEFORE INSERT ON self_analysis_entries WHEN NEW.question_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM self_analysis_questions q
    WHERE q.id=NEW.question_id AND q.session_id=NEW.session_id
  ) THEN RAISE(ABORT,'entry question session mismatch') END;
END;

CREATE TRIGGER self_entry_confirmation_state_insert
BEFORE INSERT ON self_analysis_entries
BEGIN
  SELECT CASE WHEN NEW.provenance_type='MEMBER_CONFIRMED' AND NEW.response_status<>'ANSWERED'
  THEN RAISE(ABORT,'confirmed entry must be answered') END;
END;

CREATE TRIGGER self_entry_confirmation_state_update
BEFORE UPDATE OF provenance_type,response_status ON self_analysis_entries
BEGIN
  SELECT CASE WHEN NEW.provenance_type='MEMBER_CONFIRMED' AND NEW.response_status<>'ANSWERED'
  THEN RAISE(ABORT,'confirmed entry must be answered') END;
END;

CREATE TRIGGER self_entry_question_same_session_update
BEFORE UPDATE OF question_id,session_id ON self_analysis_entries WHEN NEW.question_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM self_analysis_questions q
    WHERE q.id=NEW.question_id AND q.session_id=NEW.session_id
  ) THEN RAISE(ABORT,'entry question session mismatch') END;
END;

CREATE TRIGGER future_evidence_same_member_unit_insert
BEFORE INSERT ON future_vision_evidence_refs
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM future_vision_versions v
    JOIN self_analysis_entries e ON e.id=NEW.entry_id
    JOIN self_analysis_sessions s ON s.id=e.session_id
    WHERE v.id=NEW.future_vision_version_id
      AND v.member_id=s.member_id AND v.unit_id=s.unit_id
  ) THEN RAISE(ABORT,'future evidence owner mismatch') END;
END;

CREATE TRIGGER self_session_state_insert
BEFORE INSERT ON self_analysis_sessions
BEGIN
  SELECT CASE WHEN
    (NEW.status='COMPLETED' AND NEW.completed_at IS NULL) OR
    (NEW.status<>'COMPLETED' AND NEW.completed_at IS NOT NULL)
  THEN RAISE(ABORT,'session completion state mismatch') END;
END;

CREATE TRIGGER self_session_state_update
BEFORE UPDATE OF status,completed_at ON self_analysis_sessions
BEGIN
  SELECT CASE WHEN
    (NEW.status='COMPLETED' AND NEW.completed_at IS NULL) OR
    (NEW.status<>'COMPLETED' AND NEW.completed_at IS NOT NULL)
  THEN RAISE(ABORT,'session completion state mismatch') END;
  SELECT CASE WHEN NOT (
    (OLD.status='ACTIVE' AND NEW.status IN ('COMPLETED','ON_HOLD','SKIPPED')) OR
    (OLD.status='ON_HOLD' AND NEW.status IN ('ACTIVE','COMPLETED','SKIPPED')) OR
    (OLD.status='SKIPPED' AND NEW.status='ACTIVE')
  ) THEN RAISE(ABORT,'invalid session transition') END;
END;

CREATE INDEX idx_self_session_history ON self_analysis_session_history(session_id,version);
CREATE INDEX idx_self_question_history ON self_analysis_question_history(question_id,version);
