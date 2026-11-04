-- ==============================================================================
-- Cloudflare D1 Migration: Remediate False Email Verification Backfill
-- Version: 0006_remediate_email_verification.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

-- Remediate false email_verified backfill from migration 0003:
-- Unwind email_verified status for password-bearing accounts that have no
-- record of an actual consumed verification code in verification_codes.
UPDATE users
SET email_verified = 0, email_verified_at = NULL
WHERE password IS NOT NULL
  AND auth_provider = 'email'
  AND id NOT IN (
    SELECT user_id FROM verification_codes
    WHERE purpose = 'email' AND consumed_at IS NOT NULL
  );
