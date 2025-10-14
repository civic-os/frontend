-- =====================================================
-- Role-Based Access Control (RBAC) Functions
-- =====================================================

-- Get current user's roles from JWT claims
-- Returns array of role names from JWT, or ['anonymous'] for unauthenticated users
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TEXT[] AS $$
DECLARE
  jwt_claims JSON;
  jwt_sub TEXT;
  roles_array TEXT[];
BEGIN
  -- Get full JWT claims as JSON
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true)::JSON;
  EXCEPTION WHEN OTHERS THEN
    RETURN ARRAY['anonymous'];
  END;

  IF jwt_claims IS NULL THEN
    RETURN ARRAY['anonymous'];
  END IF;

  -- Extract sub from JSON claims
  jwt_sub := jwt_claims->>'sub';

  IF jwt_sub IS NULL OR jwt_sub = '' THEN
    RETURN ARRAY['anonymous'];
  END IF;

  -- Try to extract roles from various Keycloak claim locations
  -- Priority order: realm_access.roles -> resource_access.myclient.roles -> roles
  BEGIN
    -- Try realm_access.roles first (most common for Keycloak)
    IF jwt_claims->'realm_access'->'roles' IS NOT NULL THEN
      SELECT ARRAY(SELECT json_array_elements_text(jwt_claims->'realm_access'->'roles'))
      INTO roles_array;
      RETURN roles_array;
    END IF;

    -- Try resource_access.myclient.roles (client-specific roles)
    IF jwt_claims->'resource_access'->'myclient'->'roles' IS NOT NULL THEN
      SELECT ARRAY(SELECT json_array_elements_text(jwt_claims->'resource_access'->'myclient'->'roles'))
      INTO roles_array;
      RETURN roles_array;
    END IF;

    -- Try top-level roles claim
    IF jwt_claims->'roles' IS NOT NULL THEN
      SELECT ARRAY(SELECT json_array_elements_text(jwt_claims->'roles'))
      INTO roles_array;
      RETURN roles_array;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN ARRAY[]::TEXT[];
  END;

  -- If no roles found, return empty array
  RETURN ARRAY[]::TEXT[];
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user has a specific permission on a table
-- Returns true if any of the user's roles grant the requested permission
CREATE OR REPLACE FUNCTION public.has_permission(
  p_table_name TEXT,
  p_permission TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  user_roles TEXT[];
  has_perm BOOLEAN;
BEGIN
  -- Get current user's roles (includes 'anonymous' for unauthenticated users)
  user_roles := public.get_user_roles();

  -- Check if any of the user's roles have the requested permission
  SELECT EXISTS (
    SELECT 1
    FROM metadata.roles r
    JOIN metadata.permission_roles pr ON pr.role_id = r.id
    JOIN metadata.permissions p ON p.id = pr.permission_id
    WHERE r.display_name = ANY(user_roles)
      AND p.table_name = p_table_name
      AND p.permission::TEXT = p_permission
  ) INTO has_perm;

  RETURN has_perm;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if current user has admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  user_roles TEXT[];
BEGIN
  user_roles := public.get_user_roles();
  RETURN 'admin' = ANY(user_roles);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Set or unset a permission for a role (Admin-only)
-- p_enabled: true to grant permission, false to revoke
CREATE OR REPLACE FUNCTION public.set_role_permission(
  p_role_id SMALLINT,
  p_table_name TEXT,
  p_permission TEXT,
  p_enabled BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_permission_id INTEGER;
  v_exists BOOLEAN;
BEGIN
  -- Enforce admin-only access
  IF NOT public.is_admin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin access required'
    );
  END IF;

  -- Get the permission ID
  SELECT id INTO v_permission_id
  FROM metadata.permissions
  WHERE table_name = p_table_name
    AND permission::TEXT = p_permission;

  IF v_permission_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Permission not found'
    );
  END IF;

  -- Check if the role-permission mapping exists
  SELECT EXISTS (
    SELECT 1
    FROM metadata.permission_roles
    WHERE role_id = p_role_id AND permission_id = v_permission_id
  ) INTO v_exists;

  -- Add or remove the permission based on p_enabled
  IF p_enabled AND NOT v_exists THEN
    INSERT INTO metadata.permission_roles (role_id, permission_id)
    VALUES (p_role_id, v_permission_id);
  ELSIF NOT p_enabled AND v_exists THEN
    DELETE FROM metadata.permission_roles
    WHERE role_id = p_role_id AND permission_id = v_permission_id;
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get all roles (Admin-only)
CREATE OR REPLACE FUNCTION public.get_roles()
RETURNS TABLE (
  id SMALLINT,
  display_name TEXT,
  description TEXT
) AS $$
BEGIN
  -- Enforce admin-only access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT r.id, r.display_name, r.description
  FROM metadata.roles r
  ORDER BY r.id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Get role permissions (Admin-only)
CREATE OR REPLACE FUNCTION public.get_role_permissions(p_role_id SMALLINT DEFAULT NULL)
RETURNS TABLE (
  role_id SMALLINT,
  role_name TEXT,
  table_name TEXT,
  permission_type TEXT,
  has_permission BOOLEAN
) AS $$
BEGIN
  -- Enforce admin-only access
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    r.id AS role_id,
    r.display_name AS role_name,
    p.table_name::TEXT AS table_name,
    p.permission::TEXT AS permission_type,
    EXISTS (
      SELECT 1
      FROM metadata.permission_roles pr
      WHERE pr.role_id = r.id AND pr.permission_id = p.id
    ) AS has_permission
  FROM metadata.roles r
  CROSS JOIN metadata.permissions p
  WHERE p_role_id IS NULL OR r.id = p_role_id
  ORDER BY r.id, p.table_name, p.permission;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Create a new role (Admin-only)
CREATE OR REPLACE FUNCTION public.create_role(
  p_display_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_new_role_id SMALLINT;
  v_exists BOOLEAN;
BEGIN
  -- Enforce admin-only access
  IF NOT public.is_admin() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Admin access required'
    );
  END IF;

  -- Validate display_name is not empty
  IF p_display_name IS NULL OR TRIM(p_display_name) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Role name cannot be empty'
    );
  END IF;

  -- Check if role with this display_name already exists
  SELECT EXISTS (
    SELECT 1
    FROM metadata.roles
    WHERE display_name = TRIM(p_display_name)
  ) INTO v_exists;

  IF v_exists THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Role with this name already exists'
    );
  END IF;

  -- Insert the new role
  INSERT INTO metadata.roles (display_name, description)
  VALUES (TRIM(p_display_name), TRIM(p_description))
  RETURNING id INTO v_new_role_id;

  RETURN json_build_object(
    'success', true,
    'role_id', v_new_role_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_roles() TO web_anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO web_anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO web_anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_permissions(SMALLINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_role_permission(SMALLINT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_role(TEXT, TEXT) TO authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
