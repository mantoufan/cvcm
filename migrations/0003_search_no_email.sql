-- Site search no longer collects email addresses (owner, 2026-11-15): drop the request table and the email rate counter.
DROP TABLE IF EXISTS search_requests;
ALTER TABLE search_rate DROP COLUMN emails;
