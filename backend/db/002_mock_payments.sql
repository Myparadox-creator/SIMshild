-- =============================================================================
-- SIMShield Production PostgreSQL Database Schema Extension
-- Version: 002_mock_payments.sql
-- Description: Banking accounts, beneficiaries, transactions, and risk evaluations
-- =============================================================================

-- 1. Simulated Bank Accounts Table
CREATE TABLE IF NOT EXISTS accounts (
    user_id VARCHAR(128) PRIMARY KEY,
    account_number VARCHAR(64) NOT NULL UNIQUE,
    account_holder VARCHAR(255) NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Beneficiaries Table
CREATE TABLE IF NOT EXISTS beneficiaries (
    beneficiary_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    upi_id VARCHAR(128) NOT NULL,
    account_number VARCHAR(64),
    is_new BOOLEAN NOT NULL DEFAULT TRUE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beneficiaries_user ON beneficiaries(user_id, added_at DESC);

-- 3. Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    transaction_id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(128) NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
    beneficiary_id VARCHAR(64),
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    recipient_name VARCHAR(255) NOT NULL,
    upi_id VARCHAR(128) NOT NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'MOCK_UPI',
    device_id VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'PRECHECKED',
    risk_score SMALLINT NOT NULL CHECK(risk_score BETWEEN 0 AND 100),
    risk_level VARCHAR(16) NOT NULL,
    decision VARCHAR(32) NOT NULL,
    reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    executed_at TIMESTAMPTZ,
    previous_balance NUMERIC(15, 2),
    new_balance NUMERIC(15, 2)
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_time ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status, decision);
