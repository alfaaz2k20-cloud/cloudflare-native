-- ==============================================================================
-- Cloudflare D1 Migration: Federated Auth & OTP Velocity Engine
-- Version: 0002_federated_auth.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Non-Destructive 12-Step Table Rebuild: users table
-- ------------------------------------------------------------------------------

-- Step 1: Disable foreign key constraint enforcement
PRAGMA foreign_keys = OFF;

-- Step 4: Drop any stale temporary table from interrupted runs
DROP TABLE IF EXISTS users_new;

-- Step 5: Create new users table with nullable password and federated auth fields
CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    status TEXT NOT NULL DEFAULT 'PARTICIPANT',
    password_reset_at DATETIME,
    phone TEXT UNIQUE,
    auth_provider TEXT DEFAULT 'email',
    firebase_uid TEXT UNIQUE
);

-- Step 6: Copy existing user records into the new table
INSERT INTO users_new (id, email, password, full_name, status, password_reset_at, auth_provider)
SELECT id, email, password, full_name, status, password_reset_at, 'email'
FROM users;

-- Step 7: Drop the deprecated users table
DROP TABLE users;

-- Step 8: Rename users_new to canonical users table name
ALTER TABLE users_new RENAME TO users;

-- Step 9: Recreate original indexes and create new indexes for federated lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- Step 11: Empirically verify no foreign key constraint violations exist
PRAGMA foreign_key_check;

-- Step 12: Re-enable foreign key enforcement
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 2. OTP Velocity Logs Table & Composite Indices
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS otp_velocity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_velocity_phone_time ON otp_velocity_logs(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_velocity_ip_time ON otp_velocity_logs(ip, created_at DESC);
