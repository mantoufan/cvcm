CREATE TABLE clips (
  id TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_clips_expires_at ON clips (expires_at);

CREATE TABLE clip_rate (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
