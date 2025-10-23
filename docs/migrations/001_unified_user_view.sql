-- =====================================================
-- Migration: Unified User View Architecture
-- =====================================================
-- Version: 001
-- Date: 2025-10-23
-- Description: Move civic_os_users tables to metadata schema and create unified view
--
-- This migration:
-- 1. Moves civic_os_users and civic_os_users_private to metadata schema
-- 2. Creates a unified view in public schema that combines both tables
-- 3. Updates foreign keys in dashboards and user preferences
-- 4. Private fields (full_name, phone, email) are NULL unless authorized
--
-- IMPORTANT: Run this before pulling the latest code that expects the new structure
--
-- Testing: After running, verify:
--   SELECT * FROM metadata.civic_os_users;
--   SELECT * FROM public.civic_os_users;
--   SELECT * FROM metadata.dashboards;

BEGIN;

-- =====================================================
-- Step 0: Create metadata schema if it doesn't exist
-- =====================================================

CREATE SCHEMA IF NOT EXISTS metadata;

-- =====================================================
-- Step 1: Move tables to metadata schema
-- =====================================================

ALTER TABLE public.civic_os_users SET SCHEMA metadata;
ALTER TABLE public.civic_os_users_private SET SCHEMA metadata;

-- =====================================================
-- Step 2: Create unified view in public schema
-- =====================================================

CREATE VIEW public.civic_os_users AS
SELECT
  u.id,
  u.display_name,                     -- Public shortened name ("John D.")
  u.created_at,
  u.updated_at,
  -- Private fields: visible only to self or authorized roles
  CASE
    WHEN u.id = public.current_user_id()
         OR public.has_permission('civic_os_users_private', 'read')
    THEN p.display_name
    ELSE NULL
  END AS full_name,                   -- Private full name ("John Doe")
  CASE
    WHEN u.id = public.current_user_id()
         OR public.has_permission('civic_os_users_private', 'read')
    THEN p.email
    ELSE NULL
  END AS email,
  CASE
    WHEN u.id = public.current_user_id()
         OR public.has_permission('civic_os_users_private', 'read')
    THEN p.phone
    ELSE NULL
  END AS phone
FROM metadata.civic_os_users u
LEFT JOIN metadata.civic_os_users_private p ON p.id = u.id;

-- Security invoker ensures permission checks use caller's role
ALTER VIEW public.civic_os_users SET (security_invoker = true);

GRANT SELECT ON public.civic_os_users TO web_anon, authenticated;

-- =====================================================
-- Step 3: Update foreign key constraints
-- =====================================================

-- Update dashboards table foreign key
ALTER TABLE metadata.dashboards
  DROP CONSTRAINT IF EXISTS dashboards_created_by_fkey,
  ADD CONSTRAINT dashboards_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES metadata.civic_os_users(id);

-- Update user dashboard preferences foreign key
ALTER TABLE metadata.user_dashboard_preferences
  DROP CONSTRAINT IF EXISTS user_dashboard_preferences_user_id_fkey,
  ADD CONSTRAINT user_dashboard_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES metadata.civic_os_users(id) ON DELETE CASCADE;

-- =====================================================
-- Step 4: Grant necessary permissions
-- =====================================================

-- Grant access to metadata user tables
-- web_anon needs SELECT for the public view to work (security_invoker = true)
GRANT SELECT ON metadata.civic_os_users TO web_anon, authenticated;
GRANT SELECT ON metadata.civic_os_users_private TO web_anon, authenticated;
-- Only authenticated users can modify user data
GRANT INSERT, UPDATE ON metadata.civic_os_users TO authenticated;
GRANT INSERT, UPDATE ON metadata.civic_os_users_private TO authenticated;

-- =====================================================
-- Step 5: Reload PostgREST schema cache
-- =====================================================

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================
-- Verification Queries (run after migration)
-- =====================================================

-- Check tables exist in metadata schema
-- SELECT COUNT(*) FROM metadata.civic_os_users;
-- SELECT COUNT(*) FROM metadata.civic_os_users_private;

-- Check view exists and returns data
-- SELECT id, display_name, full_name, phone, email FROM public.civic_os_users LIMIT 5;

-- Check dashboard foreign keys work
-- SELECT d.id, d.display_name, u.display_name as creator
-- FROM metadata.dashboards d
-- LEFT JOIN metadata.civic_os_users u ON u.id = d.created_by;
