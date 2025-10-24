-- Template: Add Metadata Table
-- This template shows the pattern for adding a new table to the metadata schema
--
-- Usage: Copy this template and customize for your table
-- Example: cp templates/add_metadata_table.sql deploy/v0-4-0-add_permissions_table.sql

-- Deploy civic_os:vX-Y-Z-add_your_table to pg
-- requires: previous_migration_name

BEGIN;

-- 1. Create the table in metadata schema
CREATE TABLE metadata.your_table_name (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  -- Add your columns here
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create indexes for foreign keys and common queries
-- CRITICAL: Always index foreign key columns
-- CREATE INDEX idx_your_table_fk_column ON metadata.your_table_name(foreign_key_column);

-- 3. Add comments for documentation
COMMENT ON TABLE metadata.your_table_name IS 'Description of what this table stores';
COMMENT ON COLUMN metadata.your_table_name.display_name IS 'User-friendly name';

-- 4. Create any necessary functions (e.g., computed fields, triggers)
-- Example trigger for updated_at:
CREATE OR REPLACE FUNCTION metadata.update_your_table_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_your_table_updated_at
  BEFORE UPDATE ON metadata.your_table_name
  FOR EACH ROW
  EXECUTE FUNCTION metadata.update_your_table_updated_at();

-- 5. Grant permissions
-- Core metadata tables are typically read-only for authenticated users
GRANT SELECT ON metadata.your_table_name TO authenticated;
-- If users need to modify:
-- GRANT INSERT, UPDATE, DELETE ON metadata.your_table_name TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE metadata.your_table_name_id_seq TO authenticated;

-- 6. Add RLS policies (if needed)
-- ALTER TABLE metadata.your_table_name ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY your_table_select ON metadata.your_table_name FOR SELECT
--   TO authenticated
--   USING (public.has_permission('your_table:read'));

-- 7. Insert metadata entries (if this table should appear in UI)
-- INSERT INTO metadata.entities (table_name, display_name, description, icon, sort_order)
-- VALUES ('your_table_name', 'Your Table', 'Description for users', 'icon-name', 50);
--
-- INSERT INTO metadata.properties (table_name, column_name, display_name, sort_order, show_in_list, show_in_detail)
-- VALUES
--   ('your_table_name', 'id', 'ID', 1, true, true),
--   ('your_table_name', 'display_name', 'Name', 2, true, true),
--   ('your_table_name', 'description', 'Description', 3, false, true);

COMMIT;
