-- Nostalgia "have you had / played / used it?" answers: counts per entry, nothing about who answered.

CREATE TABLE nostalgia_votes (
  id TEXT PRIMARY KEY,
  yes INTEGER NOT NULL DEFAULT 0,
  no INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- key = HMAC(day salt from search_salts, IP | entry), kept two days: answers counted from one address for one entry that
-- day. Capped (NOSTALGIA_PER_ADDRESS), not one, because a carrier NAT puts many readers behind one address.
CREATE TABLE nostalgia_vote_keys (
  key TEXT PRIMARY KEY,
  answers INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_nostalgia_vote_keys_created ON nostalgia_vote_keys (created_at);

-- ip_hash = HMAC(day salt, IP).
CREATE TABLE nostalgia_rate (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  votes INTEGER NOT NULL DEFAULT 0
);
