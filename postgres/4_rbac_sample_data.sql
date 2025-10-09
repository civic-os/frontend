-- =====================================================
-- Core RBAC Configuration
-- =====================================================
-- This script sets up the core RBAC system with default roles
-- and permissions for Civic OS system tables.
--
-- Application-specific permissions should be defined in your
-- application's init scripts (e.g., example/init-scripts/03_pot_hole_permissions.sql)

-- Insert default roles
INSERT INTO metadata.roles (display_name, description) VALUES
  ('anonymous', 'Unauthenticated users'),
  ('user', 'Standard authenticated user'),
  ('editor', 'Can create and edit content'),
  ('admin', 'Full administrative access')
ON CONFLICT DO NOTHING;

-- =====================================================
-- System Table Permissions
-- =====================================================

-- Create permissions for system tables
-- civic_os_users_private: read permission for viewing user contact info
INSERT INTO metadata.permissions (table_name, permission) VALUES
  ('civic_os_users_private', 'read')
ON CONFLICT (table_name, permission) DO NOTHING;

-- Grant civic_os_users_private read to editor and admin roles
INSERT INTO metadata.permission_roles (permission_id, role_id)
SELECT p.id, r.id
FROM metadata.permissions p
CROSS JOIN metadata.roles r
WHERE p.table_name = 'civic_os_users_private'
  AND p.permission = 'read'
  AND r.display_name IN ('editor', 'admin')
ON CONFLICT DO NOTHING;

-- =====================================================
-- Metadata Management Permissions (Admin Only)
-- =====================================================

-- Create permissions for metadata management tables
INSERT INTO metadata.permissions (table_name, permission) VALUES
  ('roles', 'read'),
  ('roles', 'create'),
  ('roles', 'update'),
  ('roles', 'delete'),
  ('permissions', 'read'),
  ('permissions', 'create'),
  ('permissions', 'update'),
  ('permissions', 'delete'),
  ('permission_roles', 'read'),
  ('permission_roles', 'create'),
  ('permission_roles', 'update'),
  ('permission_roles', 'delete')
ON CONFLICT (table_name, permission) DO NOTHING;

-- Grant all metadata permissions to admin role only
INSERT INTO metadata.permission_roles (permission_id, role_id)
SELECT p.id, r.id
FROM metadata.permissions p
CROSS JOIN metadata.roles r
WHERE p.table_name IN ('roles', 'permissions', 'permission_roles')
  AND r.display_name = 'admin'
ON CONFLICT DO NOTHING;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
