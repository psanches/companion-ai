-- Development only. This table contains only opaque grant hashes, never medical data.
CREATE TABLE IF NOT EXISTS medical_stepup_grants (
  grant_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS medical_stepup_user_idx
  ON medical_stepup_grants(user_id, session_id, expires_at);
