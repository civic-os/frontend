-- Template: Add Custom Domain
-- This template shows the pattern for adding a new PostgreSQL domain
-- with validation constraints
--
-- Usage: Copy this template and customize for your domain
-- Example: cp templates/add_domain.sql deploy/v0-4-0-add_url_domain.sql

-- Deploy civic_os:vX-Y-Z-add_your_domain to pg
-- requires: previous_migration_name

BEGIN;

-- 1. Create the domain with validation
CREATE DOMAIN your_domain_name AS VARCHAR(100)
CHECK (
  -- Add validation logic here
  -- Example: Check format using regex
  VALUE ~ '^your-regex-pattern$'
);

-- 2. Add comment explaining the domain
COMMENT ON DOMAIN your_domain_name IS
'Description of what this domain validates and its format requirements';

-- Examples of common domain patterns:

-- PATTERN 1: URL Domain
--
-- CREATE DOMAIN url_address AS VARCHAR(2048)
-- CHECK (
--   VALUE ~ '^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$'
-- );
--
-- COMMENT ON DOMAIN url_address IS
-- 'HTTP or HTTPS URL with basic format validation';

-- PATTERN 2: ZIP Code Domain (US 5-digit)
--
-- CREATE DOMAIN zip_code AS VARCHAR(5)
-- CHECK (
--   VALUE ~ '^\d{5}$'
-- );
--
-- COMMENT ON DOMAIN zip_code IS
-- 'US ZIP code (5 digits, e.g., "48104")';

-- PATTERN 3: Percentage Domain
--
-- CREATE DOMAIN percentage AS NUMERIC(5,2)
-- CHECK (
--   VALUE >= 0 AND VALUE <= 100
-- );
--
-- COMMENT ON DOMAIN percentage IS
-- 'Percentage value between 0.00 and 100.00';

-- PATTERN 4: Social Security Number (SSN)
--
-- CREATE DOMAIN ssn AS VARCHAR(9)
-- CHECK (
--   VALUE ~ '^\d{9}$'
-- );
--
-- COMMENT ON DOMAIN ssn IS
-- 'US Social Security Number (9 digits, no dashes, stored as text for security)';

-- PATTERN 5: Credit Card Number (last 4 digits only)
--
-- CREATE DOMAIN cc_last_four AS VARCHAR(4)
-- CHECK (
--   VALUE ~ '^\d{4}$'
-- );
--
-- COMMENT ON DOMAIN cc_last_four IS
-- 'Last 4 digits of credit card (for display purposes only)';

-- 3. Update metadata if this domain affects UI rendering
-- If the domain should be displayed/edited specially in the UI,
-- you may need to add type detection logic in SchemaService.getPropertyType()
-- and rendering logic in DisplayPropertyComponent/EditPropertyComponent
--
-- Example: If adding a URL domain, you might want to:
-- - Display as clickable link in DisplayPropertyComponent
-- - Provide URL input validation in EditPropertyComponent

COMMIT;
