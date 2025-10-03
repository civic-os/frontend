-- =====================================================
-- Role-Based Access Control (RBAC) Functions
-- =====================================================

-- Get current user's roles from JWT claims
-- Returns array of role names from JWT, or ['anonymous'] for unauthenticated users
CREATE OR REPLACE FUNCTION public.get_user_roles()
RETURNS TEXT[] AS $$
DECLARE
  jwt_sub TEXT;
  jwt_roles_json TEXT;
  roles_array TEXT[];
BEGIN
  -- Check if user is authenticated by looking at JWT sub claim
  jwt_sub := current_setting('request.jwt.claim.sub', true);

  IF jwt_sub IS NULL OR jwt_sub = '' THEN
    -- Unauthenticated user gets 'anonymous' role
    RETURN ARRAY['anonymous'];
  END IF;

  -- Try to get roles from JWT claim
  -- Keycloak typically stores roles in 'realm_access.roles' or 'resource_access.<client>.roles'
  -- This example uses a custom 'roles' claim for simplicity
  -- Adjust the claim path based on your Keycloak configuration
  jwt_roles_json := current_setting('request.jwt.claim.roles', true);

  IF jwt_roles_json IS NOT NULL AND jwt_roles_json != '' THEN
    -- Parse JSON array of roles (PostgREST passes arrays as comma-separated strings)
    -- Note: This assumes roles are passed as a simple array in the JWT
    roles_array := string_to_array(jwt_roles_json, ',');
    RETURN roles_array;
  END IF;

  -- If no roles in JWT, return empty array (authenticated but no roles assigned)
  -- You might want to return a default role like 'user' instead
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_roles() TO web_anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, TEXT) TO web_anon, authenticated;
