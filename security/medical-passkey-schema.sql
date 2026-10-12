-- Development-only D1 schema. No medical records or secrets stored here.
CREATE TABLE IF NOT EXISTS medical_passkey_credentials (
  credential_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  public_key BLOB NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  transports TEXT,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX IF NOT EXISTS medical_passkey_user_idx ON medical_passkey_credentials(user_id);
CREATE TABLE IF NOT EXISTS medical_passkey_challenges (
  challenge_id TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register','authenticate')),
  action TEXT,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS medical_passkey_challenge_expiry_idx ON medical_passkey_challenges(expires_at);
