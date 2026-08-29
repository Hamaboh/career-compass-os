PRAGMA foreign_keys = ON;

ALTER TABLE record_access_grants RENAME TO record_access_grants_i3;
CREATE TABLE record_access_grants (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('SELF_ANALYSIS_ENTRY','FUTURE_VISION_VERSION','GOAL_VERSION')),
  resource_id TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES app_users(id), purpose TEXT NOT NULL CHECK(length(trim(purpose))>0),
  expires_at TEXT, granted_by TEXT NOT NULL REFERENCES app_users(id), granted_at TEXT NOT NULL,
  UNIQUE(resource_type,resource_id,actor_id)
);
INSERT INTO record_access_grants SELECT * FROM record_access_grants_i3;
DROP TABLE record_access_grants_i3;
CREATE INDEX idx_record_access_grants_lookup ON record_access_grants(resource_type,resource_id,actor_id,expires_at);

CREATE TABLE goals (
  id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), unit_id TEXT NOT NULL REFERENCES units(id),
  parent_goal_id TEXT REFERENCES goals(id), current_version_id TEXT, lifecycle_status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK(lifecycle_status IN ('DRAFT','REVIEW','AWAITING_MEMBER_CONFIRMATION','CONFIRMED','ACTIVE','PAUSED','ABANDONED','ARCHIVED')),
  owner_type TEXT NOT NULL DEFAULT 'MEMBER' CHECK(owner_type='MEMBER'), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE goal_versions (
  id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES goals(id), version_no INTEGER NOT NULL CHECK(version_no>0),
  entry_route TEXT NOT NULL CHECK(entry_route IN ('EXPLORE','DIRECTION','DIRECT_GOAL','HOLD')),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200), description TEXT NOT NULL DEFAULT '' CHECK(length(description)<=4000),
  target_date TEXT, success_criteria TEXT NOT NULL DEFAULT '' CHECK(length(success_criteria)<=2000), review_cycle TEXT,
  status TEXT NOT NULL CHECK(status IN ('DRAFT','REVIEW','AWAITING_MEMBER_CONFIRMATION','CONFIRMED','SUPERSEDED')),
  change_reason TEXT, provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','UL_OBSERVATION','MEMBER_CONFIRMED')),
  confidentiality TEXT NOT NULL CHECK(confidentiality IN ('NORMAL','CONFIDENTIAL')),
  visibility TEXT NOT NULL CHECK(visibility IN ('UL_AND_EXEC','UL_ONLY')),
  ai_send_policy TEXT NOT NULL CHECK(ai_send_policy IN ('AI_SEND_ALLOWED','AI_SEND_PROHIBITED')),
  created_by TEXT NOT NULL REFERENCES app_users(id), confirmed_at TEXT, created_at TEXT NOT NULL,
  UNIQUE(goal_id,version_no), CHECK(confidentiality='NORMAL' OR (visibility='UL_ONLY' AND ai_send_policy='AI_SEND_PROHIBITED')),
  CHECK(provenance_type<>'MEMBER_CONFIRMED' OR confirmed_at IS NOT NULL)
);
CREATE TABLE goal_links (
  id TEXT PRIMARY KEY, goal_version_id TEXT NOT NULL REFERENCES goal_versions(id),
  link_type TEXT NOT NULL CHECK(link_type IN ('WHY','FUTURE_VISION','DREAM','CAREER_DIRECTION','KPI','UNIT_LEADERS_MISSION')),
  reference_id TEXT NOT NULL, relevance_note TEXT NOT NULL DEFAULT '', linked_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL,
  UNIQUE(goal_version_id,link_type,reference_id)
);
CREATE TABLE smart_audits (
  id TEXT PRIMARY KEY, goal_version_id TEXT NOT NULL UNIQUE REFERENCES goal_versions(id), audit_version INTEGER NOT NULL DEFAULT 1,
  specific_status TEXT NOT NULL, measurable_status TEXT NOT NULL, achievable_status TEXT NOT NULL, relevant_status TEXT NOT NULL, time_bound_status TEXT NOT NULL,
  reasons_json TEXT NOT NULL, exception_reason TEXT, alternative_review_method TEXT, exception_review_date TEXT,
  audited_by_type TEXT NOT NULL CHECK(audited_by_type IN ('UL_MANUAL','AI_PROPOSAL')),
  created_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL,
  CHECK(specific_status IN ('OK','NEEDS_IMPROVEMENT','MISSING') AND measurable_status IN ('OK','NEEDS_IMPROVEMENT','MISSING') AND achievable_status IN ('OK','NEEDS_IMPROVEMENT','MISSING') AND relevant_status IN ('OK','NEEDS_IMPROVEMENT','MISSING') AND time_bound_status IN ('OK','NEEDS_IMPROVEMENT','MISSING')),
  CHECK(exception_reason IS NULL OR (length(trim(exception_reason))>0 AND length(trim(alternative_review_method))>0 AND exception_review_date IS NOT NULL))
);
CREATE TABLE goal_confirmations (
  id TEXT PRIMARY KEY, goal_version_id TEXT NOT NULL UNIQUE REFERENCES goal_versions(id), method TEXT NOT NULL CHECK(method IN ('IN_PERSON','VIDEO','PHONE')),
  result TEXT NOT NULL CHECK(result IN ('APPROVED','CHANGES_REQUESTED','ON_HOLD')), member_words TEXT NOT NULL CHECK(length(trim(member_words))>0),
  confirmation_checks_json TEXT NOT NULL, confirmed_at TEXT NOT NULL, recorded_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL
);
CREATE TABLE action_items (
  id TEXT PRIMARY KEY, goal_version_id TEXT NOT NULL REFERENCES goal_versions(id), member_id TEXT NOT NULL REFERENCES members(id), owner_id TEXT NOT NULL REFERENCES app_users(id),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 300), due_at TEXT, status TEXT NOT NULL DEFAULT 'TODO' CHECK(status IN ('TODO','DOING','DONE','CANCELLED')),
  sort_order INTEGER NOT NULL DEFAULT 0, expected_evidence TEXT, provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','UL_OBSERVATION','MEMBER_CONFIRMED')),
  created_at TEXT NOT NULL
);
CREATE TABLE evidence (
  id TEXT PRIMARY KEY, action_id TEXT NOT NULL REFERENCES action_items(id), goal_version_id TEXT NOT NULL REFERENCES goal_versions(id), member_id TEXT NOT NULL REFERENCES members(id),
  kind TEXT NOT NULL CHECK(kind IN ('REFERENCE','NOTE','DELIVERABLE_METADATA')), description TEXT NOT NULL CHECK(length(trim(description))>0),
  reference_uri TEXT, occurred_on TEXT, verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED','MEMBER_CONFIRMED','UL_VERIFIED')),
  provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','UL_OBSERVATION','MEMBER_CONFIRMED')), created_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL
);

CREATE TRIGGER goal_parent_integrity_insert BEFORE INSERT ON goals WHEN NEW.parent_goal_id IS NOT NULL BEGIN
 SELECT CASE WHEN NEW.parent_goal_id=NEW.id OR NOT EXISTS(SELECT 1 FROM goals p WHERE p.id=NEW.parent_goal_id AND p.member_id=NEW.member_id AND p.unit_id=NEW.unit_id) THEN RAISE(ABORT,'goal parent mismatch') END;
END;
CREATE TRIGGER goal_current_version_update BEFORE UPDATE OF current_version_id ON goals WHEN NEW.current_version_id IS NOT NULL BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goal_versions v WHERE v.id=NEW.current_version_id AND v.goal_id=NEW.id) THEN RAISE(ABORT,'goal current version mismatch') END;
END;
CREATE TRIGGER goal_version_immutable BEFORE UPDATE ON goal_versions WHEN OLD.status IN ('CONFIRMED','SUPERSEDED') BEGIN SELECT RAISE(ABORT,'published goal version immutable'); END;
CREATE TRIGGER goal_confirm_gate BEFORE UPDATE OF lifecycle_status,current_version_id ON goals WHEN NEW.lifecycle_status IN ('CONFIRMED','ACTIVE') BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goal_versions v JOIN goal_confirmations c ON c.goal_version_id=v.id JOIN smart_audits s ON s.goal_version_id=v.id WHERE v.id=NEW.current_version_id AND v.goal_id=NEW.id AND c.result='APPROVED' AND v.provenance_type='MEMBER_CONFIRMED' AND ((s.specific_status='OK' AND s.measurable_status='OK' AND s.achievable_status='OK' AND s.relevant_status='OK' AND s.time_bound_status='OK') OR (s.exception_reason IS NOT NULL AND s.alternative_review_method IS NOT NULL AND s.exception_review_date IS NOT NULL))) THEN RAISE(ABORT,'goal confirmation gate incomplete') END;
END;
CREATE TRIGGER goal_confirmation_provenance BEFORE INSERT ON goal_confirmations WHEN NEW.result='APPROVED' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goal_versions v WHERE v.id=NEW.goal_version_id AND v.provenance_type='MEMBER_CONFIRMED') THEN RAISE(ABORT,'approved confirmation requires member confirmed version') END;
END;
CREATE TRIGGER goal_link_owner BEFORE INSERT ON goal_links WHEN NEW.link_type IN ('FUTURE_VISION','CAREER_DIRECTION') BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goal_versions gv JOIN goals g ON g.id=gv.goal_id JOIN future_vision_versions f ON f.id=NEW.reference_id WHERE gv.id=NEW.goal_version_id AND f.member_id=g.member_id AND ((NEW.link_type='FUTURE_VISION' AND f.kind='FUTURE_VISION') OR (NEW.link_type='CAREER_DIRECTION' AND f.kind='CAREER_DIRECTION'))) THEN RAISE(ABORT,'goal link owner mismatch') END;
END;
CREATE TRIGGER action_owner_revision BEFORE INSERT ON action_items BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM goal_versions v JOIN goals g ON g.id=v.goal_id WHERE v.id=NEW.goal_version_id AND g.member_id=NEW.member_id AND g.current_version_id=v.id) THEN RAISE(ABORT,'action owner or revision mismatch') END;
END;
CREATE TRIGGER evidence_owner_revision BEFORE INSERT ON evidence BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM action_items a WHERE a.id=NEW.action_id AND a.goal_version_id=NEW.goal_version_id AND a.member_id=NEW.member_id) THEN RAISE(ABORT,'evidence owner or revision mismatch') END;
END;
CREATE INDEX idx_goals_member ON goals(member_id,lifecycle_status); CREATE INDEX idx_goal_versions_goal ON goal_versions(goal_id,version_no); CREATE INDEX idx_actions_version ON action_items(goal_version_id); CREATE INDEX idx_evidence_action ON evidence(action_id);
