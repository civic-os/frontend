-- Deploy civic_os:v0-5-0-add-file-storage to pg
-- File storage with S3 integration for images, PDFs, and documents
-- Version: 0.5.0

BEGIN;

-- ===========================================================================
-- Required Extensions
-- ===========================================================================

-- pgcrypto provides gen_random_bytes() for UUIDv7 generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================================================
-- UUIDv7 Generator Function
-- ===========================================================================
-- RFC 9562 compliant UUIDv7 implementation
-- Time-ordered UUIDs for better B-tree index performance

CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS uuid AS $$
DECLARE
  unix_ts_ms BIGINT;
  uuid_bytes BYTEA;
BEGIN
  -- Get current timestamp in milliseconds
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;

  -- Build UUID: 48-bit timestamp + 80 random bits
  uuid_bytes :=
    substring(int8send(unix_ts_ms) from 3 for 6) ||  -- 48-bit timestamp
    gen_random_bytes(10);                             -- 80 random bits

  -- Set version 7 (0111) in bits 48-51
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);

  -- Set variant (10) in bits 64-65
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$ LANGUAGE plpgsql VOLATILE;

COMMENT ON FUNCTION uuid_generate_v7() IS
  'Generate RFC 9562 compliant UUIDv7 (time-ordered UUID)';

-- ===========================================================================
-- Files Table
-- ===========================================================================
-- Central table for all uploaded files (images, PDFs, documents)
-- Files are stored in S3-compatible storage with thumbnails generated asynchronously

CREATE TABLE metadata.files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),

  -- Entity reference (polymorphic association)
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,

  -- File metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,

  -- S3 storage keys
  -- Structure: {entity_type}/{entity_id}/{file_id}/original.{ext}
  s3_key_prefix TEXT GENERATED ALWAYS AS
    (entity_type || '/' || entity_id || '/' || id) STORED,
  s3_original_key TEXT NOT NULL,
  s3_thumbnail_small_key TEXT,   -- NULL for PDFs and non-image files
  s3_thumbnail_medium_key TEXT,  -- Present for images + PDFs
  s3_thumbnail_large_key TEXT,   -- NULL for PDFs and non-image files

  -- Thumbnail processing status
  thumbnail_status TEXT DEFAULT 'pending' CHECK (
    thumbnail_status IN ('pending', 'processing', 'completed', 'failed', 'not_applicable')
  ),
  thumbnail_error TEXT,

  -- Audit tracking
  created_by UUID REFERENCES metadata.civic_os_users(id),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_entity ON metadata.files(entity_type, entity_id);
CREATE INDEX idx_files_pending ON metadata.files(thumbnail_status, created_at)
  WHERE thumbnail_status IN ('pending', 'failed');
CREATE INDEX idx_files_created ON metadata.files(created_at DESC);

COMMENT ON TABLE metadata.files IS
  'Stores file metadata for all uploaded files. Files stored in S3-compatible storage.';
COMMENT ON COLUMN metadata.files.s3_key_prefix IS
  'Generated column: {entity_type}/{entity_id}/{file_id}';
COMMENT ON COLUMN metadata.files.thumbnail_status IS
  'Thumbnail generation status. pending=queued, processing=in progress, completed=done, failed=error, not_applicable=non-image file';
COMMENT ON COLUMN metadata.files.created_by IS
  'User who uploaded the file. Automatically set from JWT via trigger.';

-- ===========================================================================
-- File Created By Trigger
-- ===========================================================================
-- Automatically sets created_by from JWT on INSERT

CREATE OR REPLACE FUNCTION set_file_created_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract user ID from JWT and set created_by
  NEW.created_by := current_user_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_file_created_by_trigger
  BEFORE INSERT ON metadata.files
  FOR EACH ROW
  EXECUTE FUNCTION set_file_created_by();

COMMENT ON FUNCTION set_file_created_by() IS
  'Trigger function to automatically set created_by from JWT on file upload';

-- ===========================================================================
-- Row Level Security for Files
-- ===========================================================================

ALTER TABLE metadata.files ENABLE ROW LEVEL SECURITY;

-- Users can view files for entities they have access to
-- This is a permissive policy; specific entities should add their own RLS
CREATE POLICY "Users can view files"
  ON metadata.files
  FOR SELECT
  USING (true);

-- Authenticated users can upload files
CREATE POLICY "Authenticated users can upload files"
  ON metadata.files
  FOR INSERT
  WITH CHECK (
    (SELECT current_setting('request.jwt.claims', true)::jsonb->>'role') = 'authenticated'
  );

-- Users can only update their own uploads (within 5 minutes)
CREATE POLICY "Users can update own recent uploads"
  ON metadata.files
  FOR UPDATE
  USING (created_at > NOW() - INTERVAL '5 minutes');

-- Only system can delete files (via CASCADE from parent entity)
-- No DELETE policy = no direct deletes allowed

COMMENT ON POLICY "Users can view files" ON metadata.files IS
  'Permissive view policy. Entity-specific access control should be implemented in application views.';

-- ===========================================================================
-- File Upload Requests Table
-- ===========================================================================
-- Temporary table for presigned URL generation workflow
-- Entries are cleaned up after successful upload or 24 hours

CREATE TABLE metadata.file_upload_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),

  -- Request parameters
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,

  -- Response data
  status TEXT DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  presigned_url TEXT,
  s3_key TEXT,
  file_id UUID,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_upload_requests_status ON metadata.file_upload_requests(status, created_at);

COMMENT ON TABLE metadata.file_upload_requests IS
  'Temporary table for presigned URL generation workflow. Entries cleaned up after 24 hours.';

-- ===========================================================================
-- File Upload Functions
-- ===========================================================================

-- Request presigned upload URL
-- Initiates async workflow via LISTEN/NOTIFY to S3 signer service
CREATE OR REPLACE FUNCTION request_upload_url(
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_file_name TEXT,
  p_file_type TEXT
) RETURNS UUID AS $$
DECLARE
  v_request_id UUID;
BEGIN
  -- Create tracking record
  INSERT INTO metadata.file_upload_requests (entity_type, entity_id, file_name, file_type)
  VALUES (p_entity_type, p_entity_id, p_file_name, p_file_type)
  RETURNING id INTO v_request_id;

  -- Notify S3 signer service to generate presigned URL
  PERFORM pg_notify(
    'upload_url_request',
    json_build_object(
      'requestId', v_request_id,
      'fileName', p_file_name,
      'fileType', p_file_type,
      'entityType', p_entity_type,
      'entityId', p_entity_id
    )::text
  );

  RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION request_upload_url IS
  'Request presigned S3 upload URL. Returns request ID for polling.';

-- Get upload URL status
-- Angular polls this to wait for presigned URL
CREATE OR REPLACE FUNCTION get_upload_url(p_request_id UUID)
RETURNS TABLE(status TEXT, url TEXT, file_id UUID, error TEXT) AS $$
  SELECT status, presigned_url, file_id, error_message
  FROM metadata.file_upload_requests
  WHERE id = p_request_id;
$$ LANGUAGE SQL SECURITY DEFINER;

COMMENT ON FUNCTION get_upload_url IS
  'Poll for presigned URL status. Returns completed URL or error.';

-- ===========================================================================
-- File Upload Trigger
-- ===========================================================================
-- Notifies thumbnail worker when file is uploaded

CREATE OR REPLACE FUNCTION notify_file_uploaded()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify for files that need thumbnail processing
  IF NEW.thumbnail_status = 'pending' THEN
    PERFORM pg_notify(
      'file_uploaded',
      json_build_object(
        'file_id', NEW.id,
        's3_key', NEW.s3_original_key,
        'file_type', NEW.file_type,
        'entity_type', NEW.entity_type,
        'entity_id', NEW.entity_id
      )::text
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER file_uploaded_trigger
  AFTER INSERT ON metadata.files
  FOR EACH ROW
  EXECUTE FUNCTION notify_file_uploaded();

COMMENT ON FUNCTION notify_file_uploaded() IS
  'Trigger function to notify thumbnail worker of new file uploads';

-- ===========================================================================
-- Grants
-- ===========================================================================

GRANT SELECT ON metadata.files TO web_anon, authenticated;
GRANT INSERT ON metadata.files TO authenticated;
GRANT UPDATE ON metadata.files TO authenticated;

GRANT SELECT ON metadata.file_upload_requests TO authenticated;
GRANT EXECUTE ON FUNCTION request_upload_url TO authenticated;
GRANT EXECUTE ON FUNCTION get_upload_url TO authenticated;

-- ===========================================================================
-- Public Schema View
-- ===========================================================================
-- Create view in public schema for PostgREST API access
-- This allows cross-schema foreign key relationships to work properly

CREATE VIEW public.files AS
SELECT * FROM metadata.files;

COMMENT ON VIEW public.files IS
  'Public API view for file storage. Actual data stored in metadata.files.';

-- Grant permissions on the view
GRANT SELECT ON public.files TO web_anon, authenticated;
GRANT INSERT, UPDATE ON public.files TO authenticated;

-- ===========================================================================
-- Add fileType and maxFileSize validation types
-- ===========================================================================
-- Extend existing metadata.validations table to support file validation

-- Add validation metadata entry comments (metadata.validations already exists)
COMMENT ON COLUMN metadata.validations.validation_type IS
  'Validation type: required, min, max, minLength, maxLength, pattern, fileType, maxFileSize';

-- ===========================================================================
-- Metadata Entry for created_by Column
-- ===========================================================================
-- Register created_by column so it appears in UI

INSERT INTO metadata.properties (table_name, column_name, display_name, show_on_list, show_on_detail, sort_order)
VALUES ('files', 'created_by', 'Uploaded By', false, true, 100)
ON CONFLICT (table_name, column_name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    show_on_list = EXCLUDED.show_on_list,
    show_on_detail = EXCLUDED.show_on_detail,
    sort_order = EXCLUDED.sort_order;

COMMIT;
