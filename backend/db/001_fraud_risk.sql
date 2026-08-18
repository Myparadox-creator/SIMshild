-- =============================================================================
-- SIMShield Production PostgreSQL Database Schema
-- Version: 001_fraud_risk.sql
-- Note: Store only hashed/tokenized identifiers. Never store raw PII or OTPs.
-- =============================================================================

-- 1. Mobile Identity and Security Events Table
CREATE TABLE IF NOT EXISTS mobile_identity_events (
    event_id UUID PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    source VARCHAR(32) NOT NULL,
    platform VARCHAR(32) NOT NULL DEFAULT 'ANDROID',
    timestamp TIMESTAMPTZ NOT NULL,
    carrier VARCHAR(64),
    previous_carrier VARCHAR(64),
    sim_type VARCHAR(32),
    previous_sim_type VARCHAR(32),
    device_id_hash VARCHAR(128),
    previous_device_id_hash VARCHAR(128),
    ip_address_hash VARCHAR(128),
    country VARCHAR(8),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    simulation BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_mobile_identity_events_user_time 
    ON mobile_identity_events(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_identity_events_type_time 
    ON mobile_identity_events(event_type, timestamp DESC);

-- 2. Fraud Risk Scores History Table
CREATE TABLE IF NOT EXISTS fraud_risk_scores (
    id UUID PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    correlation_id UUID NOT NULL,
    risk_score SMALLINT NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
    risk_level VARCHAR(16) NOT NULL,
    reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fraud_risk_scores_user_level 
    ON fraud_risk_scores(user_id, risk_level, created_at DESC);

-- 3. Fraud Alerts Table
CREATE TABLE IF NOT EXISTS fraud_alerts (
    alert_id UUID PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    severity VARCHAR(16) NOT NULL,
    risk_score SMALLINT NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
    alert_type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_event_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    simulation BOOLEAN NOT NULL DEFAULT FALSE,
    triggered_at TIMESTAMPTZ NOT NULL,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user_status 
    ON fraud_alerts(user_id, status, triggered_at DESC);

-- 4. Fraud Mitigation Cases Table
CREATE TABLE IF NOT EXISTS fraud_cases (
    case_id UUID PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    alert_id UUID NOT NULL REFERENCES fraud_alerts(alert_id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    simulation BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_user_status 
    ON fraud_cases(user_id, status, created_at DESC);

-- 5. Trusted Devices Table
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL,
    device_id_hash VARCHAR(128) NOT NULL,
    platform VARCHAR(32) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    trusted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    risk_status VARCHAR(32) NOT NULL DEFAULT 'TRUSTED',
    UNIQUE(user_id, device_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user 
    ON trusted_devices(user_id, risk_status);
