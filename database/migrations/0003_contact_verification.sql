-- ==============================================================================
-- Cloudflare D1 Migration: Contact Cross-Verification & Activity Ledger
-- Version: 0003_contact_verification.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS users_new;

CREATE TABLE users_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    status TEXT NOT NULL DEFAULT 'PARTICIPANT',
    password_reset_at DATETIME,
    phone TEXT UNIQUE,
    auth_provider TEXT DEFAULT 'email',
    firebase_uid TEXT UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    phone_verified INTEGER NOT NULL DEFAULT 0,
    email_verified_at DATETIME,
    phone_verified_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO users_new (
    id, email, password, full_name, status, password_reset_at, phone, auth_provider, firebase_uid,
    email_verified, phone_verified, email_verified_at, phone_verified_at
)
SELECT 
    id, email, password, full_name, status, password_reset_at, phone, auth_provider, firebase_uid,
    CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN auth_provider = 'phone' THEN 1 ELSE 0 END,
    CASE WHEN password IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
    CASE WHEN auth_provider = 'phone' THEN CURRENT_TIMESTAMP ELSE NULL END
FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

PRAGMA foreign_key_check;

PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------------------
-- 2. Verification Codes Table for Contact Cross-Verification
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    purpose TEXT NOT NULL CHECK(purpose IN ('email', 'phone')),
    target TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_verification_codes_lookup ON verification_codes(user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_codes_target ON verification_codes(target, created_at DESC);
