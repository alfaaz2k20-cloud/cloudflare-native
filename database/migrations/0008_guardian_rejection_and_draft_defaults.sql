-- ==============================================================================
-- Cloudflare D1 Migration: Guardian Rejection Reason & Safeguarding Auditing
-- Version: 0008_guardian_rejection_and_draft_defaults.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

-- 1. Extend exhibition_applications with administrator guardian rejection reason
ALTER TABLE exhibition_applications ADD COLUMN guardian_rejection_reason TEXT;
