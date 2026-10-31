-- Run ONCE on an existing installation after backing up the database.
-- Do not run on a fresh database imported from updated schema.sql.
ALTER TABLE media_assets
  MODIFY COLUMN r2_key VARCHAR(1000) NULL,
  ADD COLUMN provider ENUM('r2','internet_archive','wikimedia_commons','nasa_library','authorized_https') NOT NULL DEFAULT 'r2' AFTER format,
  ADD COLUMN source_url VARCHAR(2000) NULL AFTER r2_key;
