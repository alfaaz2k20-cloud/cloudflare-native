-- ==============================================================================
-- Cloudflare D1 Migration: Drop OTP Velocity Logs (SMS/OTP Decommission)
-- Version: 0005_drop_otp_velocity.sql
-- Compatible with: SQLite / Cloudflare D1
-- ==============================================================================

DROP INDEX IF EXISTS idx_otp_velocity_phone_time;
DROP INDEX IF EXISTS idx_otp_velocity_ip_time;
DROP TABLE IF EXISTS otp_velocity_logs;
