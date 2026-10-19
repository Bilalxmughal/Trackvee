-- Fix composite FK on maintenance_records that prevents changing vehicle's organization_id.
-- The composite FK (organization_id, vehicle_id) → vehicles(organization_id, id) is too
-- restrictive: updating or nulling a vehicle's org breaks records even though the vehicle
-- itself still exists. Replace it with a simple vehicle_id FK and make org nullable.

-- 1. Drop the composite constraint
ALTER TABLE maintenance_records
  DROP CONSTRAINT IF EXISTS fk_maintenance_records_org_vehicle;

-- 2. Make organization_id nullable (vehicles can now have no org)
ALTER TABLE maintenance_records
  ALTER COLUMN organization_id DROP NOT NULL;

-- 3. Add a simple FK: vehicle_id → vehicles.id (preserves delete cascade)
ALTER TABLE maintenance_records
  ADD CONSTRAINT fk_maintenance_records_vehicle
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE;

-- 4. Add a separate org FK (nullable, set null on org delete)
ALTER TABLE maintenance_records
  ADD CONSTRAINT fk_maintenance_records_org
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
