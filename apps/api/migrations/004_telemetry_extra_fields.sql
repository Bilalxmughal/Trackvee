-- Migration 004: add extra telemetry fields (parsed from GT06 heartbeat)
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS ignition        BOOLEAN;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS external_power  BOOLEAN;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS immobilizer     BOOLEAN;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS voltage_level   INTEGER;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS gsm_signal      INTEGER;
ALTER TABLE telemetry ADD COLUMN IF NOT EXISTS altitude        FLOAT;
