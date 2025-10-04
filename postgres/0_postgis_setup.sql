-- =====================================================
-- PostGIS Setup (Separate Schema)
-- =====================================================
-- Install PostGIS into its own schema to keep public schema clean
-- PostGIS functions will still be accessible via search_path

-- Create postgis schema
CREATE SCHEMA IF NOT EXISTS postgis;

-- Install PostGIS extension into postgis schema
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA postgis;

-- Grant usage on postgis schema to all roles
GRANT USAGE ON SCHEMA postgis TO PUBLIC;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
