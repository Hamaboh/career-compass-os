PRAGMA foreign_keys = ON;

CREATE TABLE self_analysis_sessions (
  id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), unit_id TEXT NOT NULL REFERENCES units(id),
  route_type TEXT NOT NULL CHECK(route_type IN ('EXPLORE','DIRECTION','DIRECT_GOAL','HOLD')),
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','COMPLETED','ON_HOLD','SKIPPED')),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1), started_at TEXT NOT NULL, completed_at TEXT,
  created_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE self_analysis_questions (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES self_analysis_sessions(id),
  domain TEXT NOT NULL CHECK(domain IN ('EXPERIENCE','EMOTION','STRENGTH','VALUE','LIFE','CAREER','FUTURE')),
  prompt_text TEXT NOT NULL CHECK(length(trim(prompt_text)) BETWEEN 1 AND 500), position INTEGER NOT NULL CHECK(position>0),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1), created_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(session_id,position)
);
CREATE TABLE self_analysis_entries (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES self_analysis_sessions(id), question_id TEXT REFERENCES self_analysis_questions(id),
  response_status TEXT NOT NULL CHECK(response_status IN ('UNANSWERED','ANSWERED','UNKNOWN','DECLINED','ON_HOLD','SKIPPED')),
  response_text TEXT, provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','UL_OBSERVATION','AI_HYPOTHESIS','MEMBER_CONFIRMED')),
  confidentiality TEXT NOT NULL CHECK(confidentiality IN ('NORMAL','CONFIDENTIAL')),
  visibility TEXT NOT NULL CHECK(visibility IN ('UL_AND_EXEC','UL_ONLY')),
  ai_send_policy TEXT NOT NULL CHECK(ai_send_policy IN ('AI_SEND_ALLOWED','AI_SEND_PROHIBITED')),
  confirmed_at TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1), created_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK((response_status='ANSWERED' AND response_text IS NOT NULL AND length(trim(response_text))>0) OR (response_status<>'ANSWERED' AND response_text IS NULL)),
  CHECK((provenance_type='MEMBER_CONFIRMED' AND confirmed_at IS NOT NULL) OR (provenance_type<>'MEMBER_CONFIRMED' AND confirmed_at IS NULL)),
  CHECK(confidentiality='NORMAL' OR visibility='UL_ONLY'),
  CHECK(confidentiality='NORMAL' OR ai_send_policy='AI_SEND_PROHIBITED')
);
CREATE TABLE self_analysis_entry_history (
  id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES self_analysis_entries(id), version INTEGER NOT NULL,
  response_status TEXT NOT NULL, response_text TEXT, provenance_type TEXT NOT NULL, confidentiality TEXT NOT NULL,
  visibility TEXT NOT NULL, ai_send_policy TEXT NOT NULL, confirmed_at TEXT, changed_by TEXT NOT NULL REFERENCES app_users(id), changed_at TEXT NOT NULL,
  UNIQUE(entry_id,version)
);
CREATE TABLE future_vision_versions (
  id TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id), unit_id TEXT NOT NULL REFERENCES units(id),
  kind TEXT NOT NULL CHECK(kind IN ('FUTURE_VISION','VALUE','CAREER_DIRECTION')),
  statement TEXT NOT NULL CHECK(length(trim(statement)) BETWEEN 1 AND 2000),
  status TEXT NOT NULL CHECK(status IN ('HYPOTHESIS','MEMBER_CONFIRMED','ON_HOLD')),
  provenance_type TEXT NOT NULL CHECK(provenance_type IN ('MEMBER_STATEMENT','UL_OBSERVATION','AI_HYPOTHESIS','MEMBER_CONFIRMED')),
  confidentiality TEXT NOT NULL CHECK(confidentiality IN ('NORMAL','CONFIDENTIAL')),
  visibility TEXT NOT NULL CHECK(visibility IN ('UL_AND_EXEC','UL_ONLY')),
  ai_send_policy TEXT NOT NULL CHECK(ai_send_policy IN ('AI_SEND_ALLOWED','AI_SEND_PROHIBITED')),
  version INTEGER NOT NULL CHECK(version>=1), supersedes_id TEXT REFERENCES future_vision_versions(id), confirmed_at TEXT,
  created_by TEXT NOT NULL REFERENCES app_users(id), created_at TEXT NOT NULL,
  CHECK((status='MEMBER_CONFIRMED' AND provenance_type='MEMBER_CONFIRMED' AND confirmed_at IS NOT NULL) OR (status<>'MEMBER_CONFIRMED' AND provenance_type<>'MEMBER_CONFIRMED' AND confirmed_at IS NULL)),
  CHECK(confidentiality='NORMAL' OR visibility='UL_ONLY'), CHECK(confidentiality='NORMAL' OR ai_send_policy='AI_SEND_PROHIBITED'),
  UNIQUE(member_id,kind,version)
);
CREATE TABLE future_vision_evidence_refs (
  future_vision_version_id TEXT NOT NULL REFERENCES future_vision_versions(id), entry_id TEXT NOT NULL REFERENCES self_analysis_entries(id),
  PRIMARY KEY(future_vision_version_id,entry_id)
);
CREATE INDEX idx_self_sessions_member ON self_analysis_sessions(member_id,updated_at);
CREATE INDEX idx_self_entries_session ON self_analysis_entries(session_id,created_at);
CREATE INDEX idx_future_member_kind ON future_vision_versions(member_id,kind,version);
