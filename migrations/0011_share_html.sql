PRAGMA foreign_keys = ON;

CREATE TABLE share_snapshots (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES members(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  r2_object_key TEXT NOT NULL UNIQUE,
  content_checksum TEXT NOT NULL,
  source_refs_json TEXT NOT NULL,
  exclusion_summary_json TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES app_users(id),
  idempotency_key TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  mutation_nonce TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  UNIQUE(created_by,idempotency_key),
  CHECK(julianday(expires_at)>julianday(created_at)),
  CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);

CREATE TABLE share_tokens (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES share_snapshots(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  first_viewed_at TEXT,
  last_viewed_at TEXT,
  revoked_at TEXT,
  created_by TEXT NOT NULL REFERENCES app_users(id),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(snapshot_id,created_by,idempotency_key),
  CHECK(julianday(expires_at)>=julianday(created_at,'+7 days')),
  CHECK(julianday(expires_at)<=julianday(created_at,'+30 days')),
  CHECK(first_viewed_at IS NULL OR first_viewed_at>=created_at),
  CHECK(last_viewed_at IS NULL OR last_viewed_at>=first_viewed_at),
  CHECK(revoked_at IS NULL OR revoked_at>=created_at)
);

CREATE TABLE share_confirmations (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES share_snapshots(id),
  method TEXT NOT NULL CHECK(method IN ('IN_PERSON','VIDEO','PHONE')),
  result TEXT NOT NULL CHECK(result IN ('APPROVED','CHANGES_REQUESTED','ON_HOLD')),
  member_words TEXT NOT NULL CHECK(length(trim(member_words)) BETWEEN 1 AND 2000),
  confirmed_at TEXT NOT NULL,
  recorded_by TEXT NOT NULL REFERENCES app_users(id),
  created_at TEXT NOT NULL,
  CHECK(confirmed_at<=created_at)
);

CREATE TABLE share_access_windows (
  client_hash TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 1 CHECK(attempt_count>0),
  last_attempt_at TEXT NOT NULL,
  PRIMARY KEY(client_hash,window_started_at)
);

CREATE INDEX idx_share_snapshots_member ON share_snapshots(member_id,created_at);
CREATE INDEX idx_share_tokens_snapshot ON share_tokens(snapshot_id,expires_at);
CREATE INDEX idx_share_confirmations_snapshot ON share_confirmations(snapshot_id,confirmed_at);
CREATE INDEX idx_share_access_windows_last_attempt ON share_access_windows(last_attempt_at);

CREATE TRIGGER share_token_active_snapshot BEFORE INSERT ON share_tokens BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM share_snapshots s WHERE s.id=NEW.snapshot_id AND s.revoked_at IS NULL
      AND julianday(s.expires_at)>=julianday(NEW.expires_at)
  ) THEN RAISE(ABORT,'token requires active snapshot') END;
END;

CREATE TRIGGER share_token_revoke_one_way BEFORE UPDATE OF revoked_at ON share_tokens
WHEN OLD.revoked_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'share token already revoked'); END;

CREATE TRIGGER share_snapshot_revoke_one_way BEFORE UPDATE OF revoked_at ON share_snapshots
WHEN OLD.revoked_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'share snapshot already revoked'); END;

CREATE TRIGGER share_confirmation_active_snapshot BEFORE INSERT ON share_confirmations BEGIN
  SELECT CASE WHEN NOT EXISTS(
    SELECT 1 FROM share_snapshots s WHERE s.id=NEW.snapshot_id AND s.revoked_at IS NULL
  ) THEN RAISE(ABORT,'confirmation requires active snapshot') END;
END;
