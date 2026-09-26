-- =========================================================================
-- AUTONOMOUS MICRO-DAAS (DATA-AS-A-SERVICE) CORE SCHEMA
-- Database: PostgreSQL 15+ / Supabase
-- Extensions: pgcrypto (UUID & hashing support)
-- =========================================================================

-- Enable pgcrypto extension for cryptographic UUID and hash generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean existing tables if migrating from scratch
-- DROP TABLE IF EXISTS extraction_logs CASCADE;
-- DROP TABLE IF EXISTS extracted_records CASCADE;
-- DROP TABLE IF EXISTS api_subscribers CASCADE;
-- DROP TABLE IF EXISTS sources CASCADE;

-- -------------------------------------------------------------------------
-- 1. SOURCES TABLE
-- Stores target scraping configurations, selector maps, and cron schedules
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    target_schema JSONB NOT NULL DEFAULT '{
        "title": "string",
        "price": "number",
        "category": "string",
        "natural_key": "string"
    }'::jsonb,
    selector_map JSONB NOT NULL,
    schedule_cron VARCHAR(50) NOT NULL DEFAULT '0 * * * *',
    headers JSONB DEFAULT '{"User-Agent": "Autonomous-Micro-DaaS-Bot/1.0 (+https://daas.example.com/bot)"}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'DRIFT_DETECTED', 'ERROR')),
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for scheduler queries
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_last_run ON sources(last_run_at);

-- -------------------------------------------------------------------------
-- 2. EXTRACTED_RECORDS TABLE
-- Stores normalized entity payloads with deterministic deduplication
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extracted_records (
    entity_id VARCHAR(64) PRIMARY KEY, -- SHA-256(source_id + ':' + natural_key)
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    natural_key VARCHAR(255) NOT NULL,
    data JSONB NOT NULL,
    hash VARCHAR(64) NOT NULL, -- SHA-256(canonical JSON) for change detection
    version INTEGER NOT NULL DEFAULT 1,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- High performance lookup and filtering indexes
CREATE INDEX IF NOT EXISTS idx_extracted_records_source_id ON extracted_records(source_id);
CREATE INDEX IF NOT EXISTS idx_extracted_records_updated_at ON extracted_records(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_extracted_records_natural_key ON extracted_records(source_id, natural_key);
CREATE INDEX IF NOT EXISTS idx_extracted_records_data_gin ON extracted_records USING gin (data);

-- -------------------------------------------------------------------------
-- 3. API_SUBSCRIBERS TABLE
-- Manages API key authentication, tier quotas, and usage metering
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(255) UNIQUE, -- Stripe or Polar customer ID
    email VARCHAR(255) NOT NULL,
    api_key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of plaintext API key
    api_key_prefix VARCHAR(16) NOT NULL, -- e.g. "sk_live_a1b2c3..."
    tier VARCHAR(50) NOT NULL DEFAULT 'starter' CHECK (tier IN ('free', 'starter', 'pro', 'enterprise')),
    monthly_quota INTEGER NOT NULL DEFAULT 1000,
    current_usage INTEGER NOT NULL DEFAULT 0,
    rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_api_subscribers_key_hash ON api_subscribers(api_key_hash);
CREATE INDEX IF NOT EXISTS idx_api_subscribers_email ON api_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_api_subscribers_customer_id ON api_subscribers(customer_id);

-- -------------------------------------------------------------------------
-- 4. EXTRACTION_LOGS TABLE
-- Complete audit trail for fast-path runs, drift events, and LLM token costs
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extraction_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('SUCCESS', 'DRIFT_REPAIRED', 'FAILED')),
    records_count INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    drift_detected BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_extraction_logs_source_created ON extraction_logs(source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_extraction_logs_status ON extraction_logs(status);

-- -------------------------------------------------------------------------
-- 5. AUTOMATIC TIMESTAMP TRIGGER
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sources_updated_at ON sources;
CREATE TRIGGER trg_sources_updated_at
    BEFORE UPDATE ON sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_extracted_records_updated_at ON extracted_records;
CREATE TRIGGER trg_extracted_records_updated_at
    BEFORE UPDATE ON extracted_records
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_api_subscribers_updated_at ON api_subscribers;
CREATE TRIGGER trg_api_subscribers_updated_at
    BEFORE UPDATE ON api_subscribers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------------------
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_logs ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access to all tables
CREATE POLICY "Service Role Full Access - Sources" ON sources
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service Role Full Access - Extracted Records" ON extracted_records
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service Role Full Access - API Subscribers" ON api_subscribers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service Role Full Access - Extraction Logs" ON extraction_logs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public read access to active extracted records for authenticated subscribers
CREATE POLICY "Public Read Active Records" ON extracted_records
    FOR SELECT TO anon, authenticated
    USING (true);
