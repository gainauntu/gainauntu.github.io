-- Google account ID (OIDC "sub") of the signed-in owner, so a pinned account can be enforced on every request.
ALTER TABLE admin_sessions ADD COLUMN sub TEXT;
