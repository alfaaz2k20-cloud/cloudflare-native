-- ==============================================================================
-- Cloudflare D1 Migration: Exhibition Age Requirement Toggle (Adults vs Youth)
-- Version: 0004_exhibition_age_toggle.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

ALTER TABLE exhibitions_list ADD COLUMN require_over_18 INTEGER NOT NULL DEFAULT 1;
