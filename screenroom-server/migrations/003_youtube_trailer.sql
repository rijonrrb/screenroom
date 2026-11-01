-- Apply once to the Screenroom database BEFORE deploying updated app.js.
ALTER TABLE titles ADD COLUMN trailer_url VARCHAR(500) NULL AFTER synopsis;
