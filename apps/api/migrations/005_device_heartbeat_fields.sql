-- Migration 005: persist last heartbeat status on device record
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_ignition        BOOLEAN;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_external_power  BOOLEAN;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_immobilizer     BOOLEAN;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_voltage_level   INTEGER;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_gsm_signal      INTEGER;
