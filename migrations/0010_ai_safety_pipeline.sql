PRAGMA foreign_keys = ON;

CREATE TABLE prompt_versions (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  version TEXT NOT NULL,
  template_checksum TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','RETIRED')),
  UNIQUE(operation,version)
);

CREATE TABLE model_policies (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK(provider='DETERMINISTIC_FAKE'),
  model_alias TEXT NOT NULL CHECK(model_alias='POC_PENDING_FAKE'),
  operation TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  input_limit INTEGER NOT NULL CHECK(input_limit BETWEEN 1 AND 20000),
  output_limit INTEGER NOT NULL CHECK(output_limit BETWEEN 1 AND 10000),
  monthly_cap_microunits INTEGER NOT NULL CHECK(monthly_cap_microunits>0),
  retention_status TEXT NOT NULL CHECK(retention_status='NOT_APPLICABLE_FAKE'),
  training_status TEXT NOT NULL CHECK(training_status='NOT_APPLICABLE_FAKE'),
  UNIQUE(operation)
);

CREATE TABLE ai_requests (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK(operation IN ('QUESTION_PLAN','FUTURE_HYPOTHESIS','WHY_EXPLORE','GOAL_DRAFT','SMART_AUDIT','ACTION_PLAN','ONE_ON_ONE_PREP','ONE_ON_ONE_POST','GOAL_CHANGE')),
  actor_id TEXT NOT NULL REFERENCES app_users(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  purpose TEXT NOT NULL CHECK(length(trim(purpose)) BETWEEN 1 AND 500),
  status TEXT NOT NULL CHECK(status IN ('AWAITING_UL_APPROVAL','APPROVED','REJECTED','SENT','SUCCEEDED','FAILED','BLOCKED_BUDGET','EXPIRED')),
  context_hash TEXT NOT NULL,
  sanitized_context_cipher_ref TEXT NOT NULL,
  context_expires_at TEXT NOT NULL,
  input_refs_json TEXT NOT NULL,
  redaction_report_json TEXT NOT NULL,
  prompt_version_id TEXT NOT NULL REFERENCES prompt_versions(id),
  model_policy_id TEXT NOT NULL REFERENCES model_policies(id),
  schema_version TEXT NOT NULL,
  estimated_microunits INTEGER NOT NULL CHECK(estimated_microunits>=0),
  approved_by TEXT REFERENCES app_users(id),
  approved_at TEXT,
  approval_hash TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  actual_microunits INTEGER,
  error_code TEXT,
  idempotency_key TEXT NOT NULL,
  execution_fingerprint TEXT NOT NULL,
  executive_visible INTEGER NOT NULL CHECK(executive_visible IN (0,1)),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(actor_id,idempotency_key),
  CHECK((approved_at IS NULL AND approved_by IS NULL AND approval_hash IS NULL) OR (approved_at IS NOT NULL AND approved_by IS NOT NULL AND approval_hash IS NOT NULL))
);

CREATE TABLE ai_responses (
  request_id TEXT PRIMARY KEY REFERENCES ai_requests(id),
  status TEXT NOT NULL CHECK(status='VALIDATED'),
  facts_used_json TEXT NOT NULL,
  unknowns_json TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  warnings_json TEXT NOT NULL,
  confidence_note TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE ai_suggestions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES ai_requests(id),
  suggestion_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PENDING','ACCEPTED','PARTIALLY_ACCEPTED','REJECTED','SUPERSEDED')),
  source_refs_json TEXT NOT NULL,
  decision_by TEXT REFERENCES app_users(id),
  decision_at TEXT,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  CHECK((decision_by IS NULL AND decision_at IS NULL) OR (decision_by IS NOT NULL AND decision_at IS NOT NULL))
);

CREATE TABLE ai_adopted_drafts (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL UNIQUE REFERENCES ai_suggestions(id),
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  owner_actor_id TEXT NOT NULL REFERENCES app_users(id),
  content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 4000),
  provenance_type TEXT NOT NULL CHECK(provenance_type='UL_OBSERVATION'),
  confirmation_status TEXT NOT NULL CHECK(confirmation_status='HUMAN_DRAFT'),
  edit_diff_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE ai_budget_ledger (
  id TEXT PRIMARY KEY,
  month TEXT NOT NULL,
  request_id TEXT NOT NULL UNIQUE REFERENCES ai_requests(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  actor_id TEXT NOT NULL REFERENCES app_users(id),
  operation TEXT NOT NULL,
  estimated_microunits INTEGER NOT NULL CHECK(estimated_microunits>=0),
  actual_microunits INTEGER,
  status TEXT NOT NULL CHECK(status IN ('RESERVED','SETTLED','RELEASED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_ai_requests_actor_time ON ai_requests(actor_id,created_at);
CREATE INDEX idx_ai_requests_member_time ON ai_requests(member_id,created_at);
CREATE INDEX idx_ai_suggestions_request ON ai_suggestions(request_id,status);
CREATE INDEX idx_ai_budget_month ON ai_budget_ledger(month,status);

CREATE TRIGGER ai_request_approval_actor BEFORE UPDATE OF status ON ai_requests
WHEN NEW.status='APPROVED' BEGIN
  SELECT CASE WHEN NEW.approved_by<>OLD.actor_id THEN RAISE(ABORT,'approval must be owning UL') END;
END;

CREATE TRIGGER ai_request_state_transition BEFORE UPDATE OF status ON ai_requests
WHEN NEW.status<>OLD.status BEGIN
  SELECT CASE WHEN NOT (
    (OLD.status='AWAITING_UL_APPROVAL' AND NEW.status IN ('APPROVED','REJECTED','BLOCKED_BUDGET','EXPIRED')) OR
    (OLD.status='APPROVED' AND NEW.status IN ('SENT','FAILED')) OR
    (OLD.status='SENT' AND NEW.status IN ('SUCCEEDED','FAILED'))
  ) THEN RAISE(ABORT,'invalid ai request state transition') END;
END;

CREATE TRIGGER ai_response_requires_sent BEFORE INSERT ON ai_responses BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_requests r WHERE r.id=NEW.request_id AND r.status='SENT')
    THEN RAISE(ABORT,'response requires sent request') END;
END;

CREATE TRIGGER ai_suggestion_requires_success BEFORE INSERT ON ai_suggestions BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_requests r WHERE r.id=NEW.request_id AND r.status='SENT')
    THEN RAISE(ABORT,'suggestion requires sent request') END;
END;

CREATE TRIGGER ai_decision_once BEFORE UPDATE OF status ON ai_suggestions
WHEN OLD.status<>'PENDING' BEGIN SELECT RAISE(ABORT,'suggestion already decided'); END;

CREATE TRIGGER ai_budget_reserve_requires_approval BEFORE INSERT ON ai_budget_ledger BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_requests r WHERE r.id=NEW.request_id AND r.status='APPROVED' AND r.actor_id=NEW.actor_id AND r.unit_id=NEW.unit_id)
    THEN RAISE(ABORT,'budget reservation requires approved request') END;
END;

CREATE TRIGGER ai_adopted_draft_human_boundary BEFORE INSERT ON ai_adopted_drafts BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM ai_suggestions s JOIN ai_requests r ON r.id=s.request_id
    WHERE s.id=NEW.suggestion_id AND s.status IN ('ACCEPTED','PARTIALLY_ACCEPTED')
      AND s.decision_by=NEW.owner_actor_id AND r.member_id=NEW.member_id AND r.unit_id=NEW.unit_id
  ) THEN RAISE(ABORT,'adopted draft requires human decision') END;
END;

INSERT INTO prompt_versions(id,operation,version,template_checksum,schema_version,status) VALUES
('prompt_question_plan_v1','QUESTION_PLAN','1','sha256:fake-question-plan-v1','1','ACTIVE'),
('prompt_future_hypothesis_v1','FUTURE_HYPOTHESIS','1','sha256:fake-future-hypothesis-v1','1','ACTIVE'),
('prompt_why_explore_v1','WHY_EXPLORE','1','sha256:fake-why-explore-v1','1','ACTIVE'),
('prompt_goal_draft_v1','GOAL_DRAFT','1','sha256:fake-goal-draft-v1','1','ACTIVE'),
('prompt_smart_audit_v1','SMART_AUDIT','1','sha256:fake-smart-audit-v1','1','ACTIVE'),
('prompt_action_plan_v1','ACTION_PLAN','1','sha256:fake-action-plan-v1','1','ACTIVE'),
('prompt_one_on_one_prep_v1','ONE_ON_ONE_PREP','1','sha256:fake-one-on-one-prep-v1','1','ACTIVE'),
('prompt_one_on_one_post_v1','ONE_ON_ONE_POST','1','sha256:fake-one-on-one-post-v1','1','ACTIVE'),
('prompt_goal_change_v1','GOAL_CHANGE','1','sha256:fake-goal-change-v1','1','ACTIVE');

INSERT INTO model_policies(id,provider,model_alias,operation,enabled,input_limit,output_limit,monthly_cap_microunits,retention_status,training_status) VALUES
('model_question_plan_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','QUESTION_PLAN',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_future_hypothesis_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','FUTURE_HYPOTHESIS',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_why_explore_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','WHY_EXPLORE',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_goal_draft_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','GOAL_DRAFT',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_smart_audit_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','SMART_AUDIT',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_action_plan_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','ACTION_PLAN',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_one_on_one_prep_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','ONE_ON_ONE_PREP',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_one_on_one_post_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','ONE_ON_ONE_POST',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE'),
('model_goal_change_fake','DETERMINISTIC_FAKE','POC_PENDING_FAKE','GOAL_CHANGE',1,6000,2000,1000000000,'NOT_APPLICABLE_FAKE','NOT_APPLICABLE_FAKE');
