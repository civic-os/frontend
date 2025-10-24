-- Revert civic_os:v0-5-0-add-file-storage from pg

BEGIN;

-- Drop public view
DROP VIEW IF EXISTS public.files CASCADE;

-- Drop metadata entry
DELETE FROM metadata.properties WHERE table_name = 'files' AND column_name = 'created_by';

-- Drop tables (CASCADE removes dependent objects including triggers)
DROP TABLE IF EXISTS metadata.file_upload_requests CASCADE;
DROP TABLE IF EXISTS metadata.files CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS set_file_created_by() CASCADE;
DROP FUNCTION IF EXISTS notify_file_uploaded() CASCADE;
DROP FUNCTION IF EXISTS get_upload_url(UUID);
DROP FUNCTION IF EXISTS request_upload_url(TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS uuid_generate_v7();

COMMIT;
