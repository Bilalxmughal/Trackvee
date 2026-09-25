-- 017: Add schedule column to geofences
-- schedule JSONB: null = always active
-- { enabled: true, days: [0,1,2,3,4,5,6], startTime: "09:00", endTime: "18:00" }
-- days: 0=Sun, 1=Mon, ... 6=Sat (JS Date.getDay() convention)

ALTER TABLE geofences
  ADD COLUMN IF NOT EXISTS schedule JSONB DEFAULT NULL;
