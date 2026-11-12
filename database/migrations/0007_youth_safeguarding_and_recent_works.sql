-- ==============================================================================
-- Cloudflare D1 Migration: Youth Safeguarding & Under-18 Recent Works Upload Setting
-- Version: 0007_youth_safeguarding_and_recent_works.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

-- 1. Extend exhibitions_list with under-18 recent works toggle, cover image, and publishing status
ALTER TABLE exhibitions_list ADD COLUMN allow_recent_works_youth INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exhibitions_list ADD COLUMN cover_image TEXT;
ALTER TABLE exhibitions_list ADD COLUMN status TEXT NOT NULL DEFAULT 'PUBLISHED';

-- 2. Extend exhibition_applications with recent works and youth guardian safeguarding fields
ALTER TABLE exhibition_applications ADD COLUMN recent_works_url TEXT;
ALTER TABLE exhibition_applications ADD COLUMN guardian_name TEXT;
ALTER TABLE exhibition_applications ADD COLUMN guardian_relationship TEXT;
ALTER TABLE exhibition_applications ADD COLUMN guardian_contact TEXT;
ALTER TABLE exhibition_applications ADD COLUMN guardian_consent_granted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exhibition_applications ADD COLUMN guardian_consent_version TEXT;
ALTER TABLE exhibition_applications ADD COLUMN guardian_consent_timestamp DATETIME;
ALTER TABLE exhibition_applications ADD COLUMN participant_assent_granted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE exhibition_applications ADD COLUMN guardian_verification_status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE exhibition_applications ADD COLUMN guardian_verified_at DATETIME;
ALTER TABLE exhibition_applications ADD COLUMN guardian_verified_by TEXT;
