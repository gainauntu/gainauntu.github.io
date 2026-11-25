-- Owner dashboard sessions for Google sign-in. Only the SHA-256 of the session cookie is stored.
CREATE TABLE IF NOT EXISTS admin_sessions (
  id          TEXT PRIMARY KEY,           -- base64url SHA-256 of the random session token
  email       TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expires ON admin_sessions (expires_at);
