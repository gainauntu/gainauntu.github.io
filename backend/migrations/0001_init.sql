-- Inquiry storage. Private: only the two Workers can read it (D1 binding); nothing here is reachable from the website.
CREATE TABLE inquiries (
  id              TEXT PRIMARY KEY,                -- random 128-bit id, never shown publicly
  ref             TEXT NOT NULL UNIQUE,            -- reference shown to the visitor (random, not sequential)
  idem_key        TEXT NOT NULL UNIQUE,            -- client-generated per submission attempt: retries return the same inquiry
  content_hash    TEXT NOT NULL,                   -- duplicate guard for double submissions with a new key
  intent          TEXT NOT NULL CHECK (intent IN ('project', 'collab', 'msg')),
  lang            TEXT NOT NULL CHECK (lang IN ('en', 'ko', 'bn')),
  reply_lang      TEXT NOT NULL CHECK (reply_lang IN ('en', 'ko', 'bn')),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  org             TEXT,
  fields_json     TEXT NOT NULL,                   -- validated fields (keys from an allow-list)
  brief           TEXT NOT NULL,                   -- the readable brief the visitor reviewed
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'pending', 'replied', 'archived')),
  board_optin     INTEGER NOT NULL DEFAULT 0 CHECK (board_optin IN (0, 1)),
  board_approved  INTEGER NOT NULL DEFAULT 0 CHECK (board_approved IN (0, 1)),
  client_hash     TEXT,                            -- keyed hash of the client IP for rate limits; cleared by retention
  notify_status   TEXT NOT NULL DEFAULT 'pending' CHECK (notify_status IN ('pending', 'accepted', 'failed', 'skipped', 'delivered', 'bounced', 'delayed', 'complained')),
  notify_id       TEXT,
  confirm_status  TEXT NOT NULL DEFAULT 'off' CHECK (confirm_status IN ('off', 'pending', 'accepted', 'failed', 'delivered', 'bounced', 'delayed', 'complained')),
  confirm_id      TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  read_at         INTEGER,
  replied_at      INTEGER,
  archived_at     INTEGER
);
CREATE INDEX inquiries_status ON inquiries (status, created_at);
CREATE INDEX inquiries_hash ON inquiries (content_hash, created_at);
CREATE INDEX inquiries_client ON inquiries (client_hash, created_at);
CREATE INDEX inquiries_board ON inquiries (board_optin, board_approved, created_at);

CREATE TABLE replies (
  id            TEXT PRIMARY KEY,
  inquiry_id    TEXT NOT NULL REFERENCES inquiries (id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  channel       TEXT NOT NULL CHECK (channel IN ('email', 'manual')),   -- manual = you answered elsewhere and recorded it
  status        TEXT NOT NULL CHECK (status IN ('accepted', 'failed', 'delivered', 'bounced', 'delayed', 'complained', 'recorded')),
  provider_id   TEXT,
  error         TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);
CREATE INDEX replies_inquiry ON replies (inquiry_id, created_at);
CREATE INDEX replies_provider ON replies (provider_id);

CREATE TABLE email_events (                      -- verified provider webhooks, kept briefly for troubleshooting
  svix_id      TEXT PRIMARY KEY,                  -- replay protection: each webhook delivery is processed once
  provider_id  TEXT,
  type         TEXT NOT NULL,
  created_at   INTEGER NOT NULL
);
