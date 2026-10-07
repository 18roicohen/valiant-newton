-- Production Cloudflare D1 (SQLite) Schema for DYNEP

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  target_schema TEXT NOT NULL,
  selector_map TEXT NOT NULL,
  schedule_cron TEXT DEFAULT '*/15 * * * *',
  headers TEXT DEFAULT '{}',
  status TEXT DEFAULT 'ACTIVE',
  last_run_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS records (
  entity_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  natural_key TEXT NOT NULL,
  gpu_model TEXT,
  provider TEXT,
  price_hourly REAL,
  vram_gb INTEGER,
  region TEXT DEFAULT 'Global',
  deploy_url TEXT,
  data TEXT NOT NULL,
  hash TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  first_seen_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_records_source_id ON records(source_id);
CREATE INDEX IF NOT EXISTS idx_records_updated_at ON records(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_records_gpu_price ON records(gpu_model, price_hourly);
CREATE INDEX IF NOT EXISTS idx_records_provider ON records(provider);

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  email TEXT UNIQUE NOT NULL,
  api_key_hash TEXT UNIQUE NOT NULL,
  api_key_prefix TEXT NOT NULL,
  tier TEXT DEFAULT 'starter',
  monthly_quota INTEGER DEFAULT 1000,
  current_usage INTEGER DEFAULT 0,
  rate_limit_rpm INTEGER DEFAULT 60,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscribers_api_key_hash ON subscribers(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  gpu_model TEXT NOT NULL,
  target_price_usd REAL NOT NULL,
  channel TEXT DEFAULT 'email',
  webhook_url TEXT,
  is_active INTEGER DEFAULT 1,
  last_notified_at TEXT,
  last_notified_price REAL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alerts_active_model ON alerts(is_active, gpu_model);

CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,
  records_count INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  drift_detected INTEGER DEFAULT 0,
  error_message TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
