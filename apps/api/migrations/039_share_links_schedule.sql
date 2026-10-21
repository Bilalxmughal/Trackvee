ALTER TABLE share_links
  ADD COLUMN IF NOT EXISTS schedule_start VARCHAR(5),
  ADD COLUMN IF NOT EXISTS schedule_end   VARCHAR(5);
