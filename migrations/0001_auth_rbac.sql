PRAGMA foreign_keys = ON;
CREATE TABLE app_users (
  id TEXT PRIMARY KEY, access_subject TEXT NOT NULL UNIQUE, email_normalized TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('ACTIVE','SUSPENDED','REVOKED')),
  last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE roles (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE CHECK(code IN ('SYSTEM_ADMIN','EXECUTIVE','UL')));
CREATE TABLE user_roles (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id), role_id TEXT NOT NULL REFERENCES roles(id),
  valid_from TEXT NOT NULL, valid_to TEXT, granted_by TEXT REFERENCES app_users(id),
  CHECK(valid_to IS NULL OR valid_to > valid_from), UNIQUE(user_id,role_id,valid_from)
);
CREATE TABLE units (
  id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','INACTIVE'))
);
CREATE TABLE user_unit_scopes (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES app_users(id), unit_id TEXT NOT NULL REFERENCES units(id),
  scope_type TEXT NOT NULL DEFAULT 'PRIMARY' CHECK(scope_type IN ('PRIMARY','EXPLICIT')),
  valid_from TEXT NOT NULL, valid_to TEXT, granted_by TEXT REFERENCES app_users(id),
  CHECK(valid_to IS NULL OR valid_to > valid_from), UNIQUE(user_id,unit_id,valid_from)
);
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY, event_type TEXT NOT NULL, occurred_at TEXT NOT NULL, actor_id TEXT REFERENCES app_users(id),
  target_type TEXT NOT NULL, target_id TEXT, outcome TEXT NOT NULL CHECK(outcome IN ('ALLOWED','DENIED','SUCCEEDED')),
  reason TEXT NOT NULL, request_id TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_user_roles_current ON user_roles(user_id,valid_from,valid_to);
CREATE INDEX idx_user_unit_scopes_current ON user_unit_scopes(user_id,unit_id,valid_from,valid_to);
CREATE INDEX idx_audit_events_actor_time ON audit_events(actor_id,occurred_at);
INSERT INTO roles(id,code) VALUES ('role_system_admin','SYSTEM_ADMIN'),('role_executive','EXECUTIVE'),('role_ul','UL');
