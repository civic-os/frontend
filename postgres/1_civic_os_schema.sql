-- =====================================================
-- Civic OS User Tables
-- =====================================================

-- Public user information
CREATE TABLE public.civic_os_users (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT civic_os_users_display_name_key UNIQUE (display_name)
);

ALTER TABLE public.civic_os_users ENABLE ROW LEVEL SECURITY;

-- Everyone can read public user info
CREATE POLICY "Everyone can read users"
  ON public.civic_os_users
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Private user information
CREATE TABLE public.civic_os_users_private (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  phone VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT civic_os_users_private_user_id FOREIGN KEY (id)
    REFERENCES public.civic_os_users (id)
    ON UPDATE NO ACTION ON DELETE CASCADE
);

ALTER TABLE public.civic_os_users_private ENABLE ROW LEVEL SECURITY;

-- Users can only read their own private info
CREATE POLICY "Users can read own private info"
  ON public.civic_os_users_private
  FOR SELECT
  TO authenticated
  USING (id = public.current_user_id());

-- =====================================================
-- User Refresh Function
-- =====================================================

-- Function to refresh current user data from JWT claims
-- Automatically creates/updates user records from authentication token
-- Can be called via PostgREST: POST /rpc/refresh_current_user
CREATE OR REPLACE FUNCTION public.refresh_current_user()
RETURNS public.civic_os_users AS $$
DECLARE
  v_user_id UUID;
  v_display_name TEXT;
  v_email TEXT;
  v_result public.civic_os_users;
BEGIN
  -- Get claims from JWT
  v_user_id := public.current_user_id();
  v_display_name := public.current_user_name();
  v_email := public.current_user_email();

  -- Validate we have required data
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found in JWT';
  END IF;

  IF v_display_name IS NULL OR v_display_name = '' THEN
    RAISE EXCEPTION 'No display name found in JWT (name or preferred_username claim required)';
  END IF;

  -- Upsert into civic_os_users (public profile)
  INSERT INTO public.civic_os_users (id, display_name, created_at, updated_at)
  VALUES (v_user_id, v_display_name, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        updated_at = NOW();

  -- Upsert into civic_os_users_private (private profile)
  INSERT INTO public.civic_os_users_private (id, display_name, email, created_at, updated_at)
  VALUES (v_user_id, v_display_name, v_email, NOW(), NOW())
  ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        updated_at = NOW();

  -- Return the public user record
  SELECT * INTO v_result
  FROM public.civic_os_users
  WHERE id = v_user_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users only
GRANT EXECUTE ON FUNCTION public.refresh_current_user() TO authenticated;

-- =====================================================
-- Metadata Schema (Civic OS Core)
-- =====================================================

CREATE SCHEMA IF NOT EXISTS metadata;

-- Entity metadata table
CREATE TABLE metadata.entities (
  table_name NAME PRIMARY KEY,
  display_name TEXT,
  description TEXT,
  sort_order INT
);

-- Property metadata table
CREATE TABLE metadata.properties (
  table_name NAME,
  column_name NAME,
  display_name TEXT,
  description TEXT,
  sort_order INT,
  column_width INT,
  PRIMARY KEY (table_name, column_name)
);

-- Permissions enum
CREATE TYPE metadata.permission AS ENUM ('create', 'read', 'update', 'delete');

-- Permissions table
CREATE TABLE metadata.permissions (
  id SERIAL PRIMARY KEY,
  table_name NAME NOT NULL,
  permission metadata.permission NOT NULL,
  UNIQUE (table_name, permission)
);

-- Roles table
CREATE TABLE metadata.roles (
  id SMALLSERIAL PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT
);

ALTER TABLE metadata.roles ENABLE ROW LEVEL SECURITY;

-- Permission-Role mapping
CREATE TABLE metadata.permission_roles (
  permission_id INTEGER,
  role_id SMALLINT,
  PRIMARY KEY (permission_id, role_id),
  FOREIGN KEY (permission_id) REFERENCES metadata.permissions (id),
  FOREIGN KEY (role_id) REFERENCES metadata.roles (id)
);

-- Grant permissions on metadata schema
GRANT USAGE ON SCHEMA metadata TO web_anon, authenticated;
GRANT SELECT ON metadata.entities TO web_anon, authenticated;
GRANT SELECT ON metadata.properties TO web_anon, authenticated;
GRANT SELECT ON metadata.permissions TO web_anon, authenticated;
GRANT SELECT ON metadata.roles TO web_anon, authenticated;
GRANT SELECT ON metadata.permission_roles TO web_anon, authenticated;

-- =====================================================
-- Schema Relations Function
-- =====================================================

CREATE FUNCTION public.schema_relations_func()
RETURNS TABLE (
  src_schema NAME,
  src_table NAME,
  src_column NAME,
  constraint_schema NAME,
  constraint_name NAME,
  join_schema NAME,
  join_table NAME,
  join_column NAME
)
LANGUAGE 'sql'
SECURITY DEFINER
AS $BODY$
SELECT
  k_c_u.table_schema AS src_schema,
  k_c_u.table_name AS src_table,
  k_c_u.column_name AS src_column,
  c_c_u.constraint_schema,
  c_c_u.constraint_name,
  c_c_u.table_schema AS join_schema,
  c_c_u.table_name AS join_table,
  c_c_u.column_name AS join_column
FROM
  information_schema.key_column_usage AS k_c_u
  JOIN information_schema.referential_constraints r_c
    ON k_c_u.constraint_name::name = r_c.constraint_name::name
  JOIN information_schema.constraint_column_usage c_c_u
    ON r_c.unique_constraint_name::name = c_c_u.constraint_name::name;
$BODY$;

GRANT EXECUTE ON FUNCTION public.schema_relations_func() TO web_anon, authenticated;

-- =====================================================
-- Schema Entities View
-- =====================================================

CREATE OR REPLACE VIEW public.schema_entities AS
SELECT
  COALESCE(entities.display_name, grants.table_name::text) AS display_name,
  COALESCE(entities.sort_order, 0) AS sort_order,
  entities.description,
  grants.table_name,
  grants.insert,
  grants.select,
  grants.update,
  grants.delete
FROM (
  SELECT
    role_table_grants.table_name,
    bool_or(role_table_grants.privilege_type::text = 'INSERT'::text) AS insert,
    bool_or(role_table_grants.privilege_type::text = 'SELECT'::text) AS "select",
    bool_or(role_table_grants.privilege_type::text = 'UPDATE'::text) AS update,
    bool_or(role_table_grants.privilege_type::text = 'DELETE'::text) AS delete
  FROM information_schema.role_table_grants
  JOIN information_schema.tables
    ON role_table_grants.table_schema::name = tables.table_schema::name
    AND role_table_grants.table_name::name = tables.table_name::name
  WHERE role_table_grants.table_schema::name = 'public'::name
    AND role_table_grants.grantee::name = CURRENT_ROLE
    AND tables.table_type::text = 'BASE TABLE'::text
  GROUP BY role_table_grants.grantee, role_table_grants.table_name
) grants
LEFT JOIN metadata.entities ON entities.table_name = grants.table_name::name
WHERE grants.table_name::name <> ALL (ARRAY['civic_os_users'::name, 'civic_os_users_private'::name])
ORDER BY COALESCE(entities.sort_order, 0), grants.table_name;

GRANT SELECT ON public.schema_entities TO web_anon, authenticated;

-- =====================================================
-- Schema Properties View
-- =====================================================

CREATE OR REPLACE VIEW public.schema_properties WITH (security_invoker = true) AS
SELECT
  columns.table_catalog,
  columns.table_schema,
  columns.table_name,
  columns.column_name,
  COALESCE(
    properties.display_name,
    initcap(replace(columns.column_name::text, '_'::text, ' '::text))
  ) AS display_name,
  properties.description,
  COALESCE(
    properties.sort_order,
    columns.ordinal_position::integer
  ) AS sort_order,
  properties.column_width,
  columns.column_default,
  columns.is_nullable::text = 'YES'::text AS is_nullable,
  columns.data_type,
  columns.character_maximum_length,
  columns.udt_schema,
  columns.udt_name,
  columns.is_self_referencing::text = 'YES'::text AS is_self_referencing,
  columns.is_identity::text = 'YES'::text AS is_identity,
  columns.is_generated::text = 'ALWAYS'::text AS is_generated,
  columns.is_updatable::text = 'YES'::text AS is_updatable,
  relations.join_schema,
  relations.join_table,
  relations.join_column
FROM information_schema.columns
LEFT JOIN (
  SELECT
    schema_relations_func.src_schema,
    schema_relations_func.src_table,
    schema_relations_func.src_column,
    schema_relations_func.constraint_schema,
    schema_relations_func.constraint_name,
    schema_relations_func.join_schema,
    schema_relations_func.join_table,
    schema_relations_func.join_column
  FROM schema_relations_func() schema_relations_func(
    src_schema,
    src_table,
    src_column,
    constraint_schema,
    constraint_name,
    join_schema,
    join_table,
    join_column
  )
) relations
  ON columns.table_schema::name = relations.src_schema
  AND columns.table_name::name = relations.src_table
  AND columns.column_name::name = relations.src_column
LEFT JOIN metadata.properties
  ON properties.table_name = columns.table_name::name
  AND properties.column_name = columns.column_name::name
WHERE columns.table_schema::name = 'public'::name
  AND columns.table_name::name IN (
    SELECT schema_entities.table_name FROM schema_entities
  );

GRANT SELECT ON public.schema_properties TO web_anon, authenticated;

-- =====================================================
-- Reusable Timestamp Trigger Functions
-- =====================================================

-- Automatically set created_at on INSERT
CREATE OR REPLACE FUNCTION public.set_created_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Automatically set updated_at on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to user tables
CREATE TRIGGER set_created_at_trigger
  BEFORE INSERT ON public.civic_os_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_at();

CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON public.civic_os_users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_created_at_trigger
  BEFORE INSERT ON public.civic_os_users_private
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_at();

CREATE TRIGGER set_updated_at_trigger
  BEFORE INSERT OR UPDATE ON public.civic_os_users_private
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- Grant schema permissions
-- =====================================================

GRANT USAGE ON SCHEMA public TO web_anon, authenticated;
GRANT SELECT ON public.civic_os_users TO web_anon, authenticated;
GRANT SELECT ON public.civic_os_users_private TO authenticated;
