CREATE TABLE IF NOT EXISTS keepalive_runs (
  id TEXT PRIMARY KEY,
  trigger TEXT NOT NULL,
  base_url TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  scheduled_at TEXT,
  cron TEXT,
  ok INTEGER NOT NULL,
  checked INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS keepalive_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  idx INTEGER NOT NULL,
  endpoint_type TEXT NOT NULL,
  path TEXT NOT NULL,
  ok INTEGER NOT NULL,
  status INTEGER,
  duration_ms INTEGER NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (run_id) REFERENCES keepalive_runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_keepalive_runs_started_at
  ON keepalive_runs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_keepalive_runs_ok
  ON keepalive_runs(ok, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_keepalive_runs_trigger
  ON keepalive_runs(trigger, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_keepalive_results_run_id
  ON keepalive_results(run_id, idx);

CREATE INDEX IF NOT EXISTS idx_keepalive_results_path
  ON keepalive_results(path, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_keepalive_results_endpoint_type
  ON keepalive_results(endpoint_type, created_at DESC);
