-- =====================================================
-- RBAC Sample Data
-- =====================================================
-- This script populates sample roles and permissions
-- Customize based on your application's needs

-- Insert sample roles
INSERT INTO metadata.roles (display_name, description) VALUES
  ('anonymous', 'Unauthenticated users'),
  ('user', 'Standard authenticated user'),
  ('editor', 'Can create and edit content'),
  ('admin', 'Full administrative access')
ON CONFLICT DO NOTHING;

-- Create permissions for all pot hole tables
INSERT INTO metadata.permissions (table_name, permission) VALUES
  ('Bid', 'read'),
  ('Bid', 'create'),
  ('Bid', 'update'),
  ('Bid', 'delete'),
  ('Issue', 'read'),
  ('Issue', 'create'),
  ('Issue', 'update'),
  ('Issue', 'delete'),
  ('IssueStatus', 'read'),
  ('IssueStatus', 'create'),
  ('IssueStatus', 'update'),
  ('IssueStatus', 'delete'),
  ('WorkDetail', 'read'),
  ('WorkDetail', 'create'),
  ('WorkDetail', 'update'),
  ('WorkDetail', 'delete'),
  ('WorkPackage', 'read'),
  ('WorkPackage', 'create'),
  ('WorkPackage', 'update'),
  ('WorkPackage', 'delete'),
  ('WorkPackageStatus', 'read'),
  ('WorkPackageStatus', 'create'),
  ('WorkPackageStatus', 'update'),
  ('WorkPackageStatus', 'delete')
ON CONFLICT (table_name, permission) DO NOTHING;

-- Grant read permission to anonymous users for all tables
INSERT INTO metadata.permission_roles (permission_id, role_id)
SELECT p.id, r.id
FROM metadata.permissions p
CROSS JOIN metadata.roles r
WHERE p.table_name IN ('Bid', 'Issue', 'IssueStatus', 'WorkDetail', 'WorkPackage', 'WorkPackageStatus')
  AND p.permission = 'read'
  AND r.display_name = 'anonymous'
ON CONFLICT DO NOTHING;

-- Grant create/update to authenticated users (user, editor, admin)
INSERT INTO metadata.permission_roles (permission_id, role_id)
SELECT p.id, r.id
FROM metadata.permissions p
CROSS JOIN metadata.roles r
WHERE p.table_name IN ('Bid', 'Issue', 'IssueStatus', 'WorkDetail', 'WorkPackage', 'WorkPackageStatus')
  AND p.permission IN ('create', 'update')
  AND r.display_name IN ('user', 'editor', 'admin')
ON CONFLICT DO NOTHING;

-- Grant delete to editors and admins only
INSERT INTO metadata.permission_roles (permission_id, role_id)
SELECT p.id, r.id
FROM metadata.permissions p
CROSS JOIN metadata.roles r
WHERE p.table_name IN ('Bid', 'Issue', 'IssueStatus', 'WorkDetail', 'WorkPackage', 'WorkPackageStatus')
  AND p.permission = 'delete'
  AND r.display_name IN ('editor', 'admin')
ON CONFLICT DO NOTHING;

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

-- Create permissions for metadata management tables (admin-only)
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
