-- Small notes the site keeps for itself, e.g. when a storage alert was last emailed.
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
