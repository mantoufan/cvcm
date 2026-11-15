-- Site search demand: queries that found nothing, and people who asked to be told when they do.

-- One row per normalised query and locale. `visitors` counts distinct visitors per day (see search_votes),
-- so one person retyping a word does not look like demand.
CREATE TABLE search_misses (
  q TEXT NOT NULL,
  locale TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  first_at INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  PRIMARY KEY (q, locale)
);

-- key = HMAC(day salt, IP | locale | query), kept for two days only: enough to count a visitor once a day.
-- The salt is random per UTC day and deleted after two days too, so an old key cannot be tied to an address.
CREATE TABLE search_votes (
  key TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_search_votes_created ON search_votes (created_at);

-- Email once when the query gets a result, then delete the row (`npm run search:notify`). At most 3 pending per address.
CREATE TABLE search_requests (
  q TEXT NOT NULL,
  locale TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (q, locale, email)
);

CREATE INDEX idx_search_requests_email ON search_requests (email);

CREATE TABLE search_salts (
  day TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- ip_hash = HMAC(day salt, IP).
CREATE TABLE search_rate (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  misses INTEGER NOT NULL DEFAULT 0,
  emails INTEGER NOT NULL DEFAULT 0
);
