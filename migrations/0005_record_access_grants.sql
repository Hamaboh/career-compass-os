PRAGMA foreign_keys = ON;

CREATE TABLE record_access_grants (
  id TEXT PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK(resource_type IN ('SELF_ANALYSIS_ENTRY','FUTURE_VISION_VERSION')),
  resource_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES app_users(id),
  purpose TEXT NOT NULL CHECK(length(trim(purpose)) > 0),
  expires_at TEXT,
  granted_by TEXT NOT NULL REFERENCES app_users(id),
  granted_at TEXT NOT NULL,
  UNIQUE(resource_type, resource_id, actor_id)
);

CREATE INDEX idx_record_access_grants_lookup
ON record_access_grants(resource_type, resource_id, actor_id, expires_at);
