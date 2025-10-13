-- =====================================================
-- Schema Cache Versioning System
-- =====================================================
--
-- Purpose: Track metadata changes to enable selective cache invalidation
-- in the frontend. Supports two-cache architecture: entities and properties.
--
-- This script:
-- 1. Adds updated_at columns to all metadata tables
-- 2. Adds triggers to auto-update timestamps
-- 3. Creates schema_cache_versions view for version checking
--

-- =====================================================
-- Add updated_at Columns
-- =====================================================

-- metadata.entities
ALTER TABLE metadata.entities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- metadata.properties
ALTER TABLE metadata.properties
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- metadata.validations
ALTER TABLE metadata.validations
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- metadata.permissions
ALTER TABLE metadata.permissions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- metadata.roles
ALTER TABLE metadata.roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- metadata.permission_roles
ALTER TABLE metadata.permission_roles
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- metadata.constraint_messages (for completeness, though not used in cache versioning)
ALTER TABLE metadata.constraint_messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- Add Triggers for Auto-Updating updated_at
-- =====================================================

-- metadata.entities
CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.entities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- metadata.properties
CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- metadata.validations
CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.validations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- metadata.permissions
CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- metadata.roles
CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- metadata.permission_roles
CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.permission_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- metadata.constraint_messages
CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON metadata.constraint_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Schema Cache Versions View
-- =====================================================

CREATE OR REPLACE VIEW public.schema_cache_versions AS
SELECT
  'entities' as cache_name,
  GREATEST(
    (SELECT COALESCE(MAX(updated_at), '1970-01-01'::timestamptz) FROM metadata.entities),
    (SELECT COALESCE(MAX(updated_at), '1970-01-01'::timestamptz) FROM metadata.permissions),
    (SELECT COALESCE(MAX(updated_at), '1970-01-01'::timestamptz) FROM metadata.roles),
    (SELECT COALESCE(MAX(updated_at), '1970-01-01'::timestamptz) FROM metadata.permission_roles)
  ) as version
UNION ALL
SELECT
  'properties' as cache_name,
  GREATEST(
    (SELECT COALESCE(MAX(updated_at), '1970-01-01'::timestamptz) FROM metadata.properties),
    (SELECT COALESCE(MAX(updated_at), '1970-01-01'::timestamptz) FROM metadata.validations)
  ) as version;

-- Set security_invoker to run with caller's permissions (respects RLS)
ALTER VIEW public.schema_cache_versions SET (security_invoker = true);

-- Grant access to all users (version info is not sensitive)
GRANT SELECT ON public.schema_cache_versions TO web_anon, authenticated;

-- =====================================================
-- Usage Example
-- =====================================================
--
-- Frontend queries this view on navigation:
--   SELECT * FROM schema_cache_versions;
--
-- Returns:
--   cache_name | version
--   -----------|------------------------
--   entities   | 2025-10-13 14:32:15+00
--   properties | 2025-10-13 15:10:42+00
--
-- If version changed since last check:
--   - entities changed → refresh SchemaService.tables
--   - properties changed → refresh SchemaService.properties
--
