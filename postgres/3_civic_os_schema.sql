-- =====================================================
-- Civic OS User Tables
-- =====================================================

-- Public user information
CREATE TABLE public.civic_os_users (
  id UUID PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

-- Anonymous users see no private data (prevents permission errors on LEFT JOINs)
CREATE POLICY "Anonymous users see no private data"
  ON public.civic_os_users_private
  FOR SELECT
  TO web_anon
  USING (false);

-- Users can only read their own private info
CREATE POLICY "Users can read own private info"
  ON public.civic_os_users_private
  FOR SELECT
  TO authenticated
  USING (id = public.current_user_id());

-- Permitted roles (editor, admin, etc.) can see all private data
CREATE POLICY "Permitted roles see all private data"
  ON public.civic_os_users_private
  FOR SELECT
  TO authenticated
  USING (public.has_permission('civic_os_users_private', 'read'));

-- =====================================================
-- User Display Name Formatting
-- =====================================================

-- Function to format full name as "First L." for public display
-- Filters out titles (Mr., Dr., etc.) and suffixes (Jr., PhD, etc.)
-- Examples: "Mr. John Doe Jr." -> "John D.", "Dr. Sarah Johnson PhD" -> "Sarah J."
CREATE OR REPLACE FUNCTION public.format_public_display_name(full_name TEXT)
RETURNS TEXT AS $$
DECLARE
  name_parts TEXT[];
  filtered_parts TEXT[];
  name_part TEXT;
  part_normalized TEXT;
  first_name TEXT;
  last_initial TEXT;
  -- Common titles/prefixes to filter out (case-insensitive, with or without periods)
  titles TEXT[] := ARRAY['MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'PROFESSOR', 'REV', 'REVEREND',
                         'SIR', 'MADAM', 'LORD', 'LADY', 'CAPT', 'CAPTAIN', 'LT', 'LIEUTENANT',
                         'COL', 'COLONEL', 'GEN', 'GENERAL', 'MAJ', 'MAJOR', 'SGT', 'SERGEANT'];
  -- Common suffixes to filter out (case-insensitive, with or without periods)
  suffixes TEXT[] := ARRAY['JR', 'JUNIOR', 'SR', 'SENIOR', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
                           'PHD', 'MD', 'DDS', 'ESQ', 'MBA', 'JD', 'DVM', 'RN', 'LPN',
                           '1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH', '9TH'];
BEGIN
  -- Handle NULL or empty string
  IF full_name IS NULL OR TRIM(full_name) = '' THEN
    RETURN 'User';
  END IF;

  -- Split name by spaces and filter out empty parts
  name_parts := ARRAY(SELECT TRIM(part) FROM UNNEST(string_to_array(full_name, ' ')) AS part WHERE TRIM(part) != '');

  -- Filter out titles and suffixes
  filtered_parts := ARRAY[]::TEXT[];
  FOREACH name_part IN ARRAY name_parts
  LOOP
    -- Normalize: uppercase and remove periods for comparison
    part_normalized := UPPER(REPLACE(name_part, '.', ''));

    -- Skip if it's a title or suffix
    IF NOT (part_normalized = ANY(titles) OR part_normalized = ANY(suffixes)) THEN
      filtered_parts := filtered_parts || name_part;
    END IF;
  END LOOP;

  -- Handle edge cases after filtering
  IF array_length(filtered_parts, 1) IS NULL OR array_length(filtered_parts, 1) = 0 THEN
    RETURN 'User';
  END IF;

  -- Handle single name (e.g., "Madonna")
  IF array_length(filtered_parts, 1) = 1 THEN
    RETURN INITCAP(filtered_parts[1]);
  END IF;

  -- Extract first name and capitalize
  first_name := INITCAP(filtered_parts[1]);

  -- Extract last name initial and capitalize
  last_initial := UPPER(SUBSTRING(filtered_parts[array_length(filtered_parts, 1)] FROM 1 FOR 1));

  -- Return formatted name: "First L."
  RETURN first_name || ' ' || last_initial || '.';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

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
  -- Store shortened name (e.g., "John D.") for privacy
  INSERT INTO public.civic_os_users (id, display_name, created_at, updated_at)
  VALUES (v_user_id, public.format_public_display_name(v_display_name), NOW(), NOW())
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
  sort_order INT,
  search_fields TEXT[]
);

ALTER TABLE metadata.entities ENABLE ROW LEVEL SECURITY;

-- Everyone can read entity metadata
CREATE POLICY "Everyone can read entities"
  ON metadata.entities
  FOR SELECT
  TO PUBLIC
  USING (true);

-- Admins can insert entity metadata
CREATE POLICY "Admins can insert entities"
  ON metadata.entities
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update entity metadata
CREATE POLICY "Admins can update entities"
  ON metadata.entities
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admins can delete entity metadata
CREATE POLICY "Admins can delete entities"
  ON metadata.entities
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Property metadata table
CREATE TABLE metadata.properties (
  table_name NAME,
  column_name NAME,
  display_name TEXT,
  description TEXT,
  sort_order INT,
  column_width INT,
  sortable BOOLEAN DEFAULT true,
  filterable BOOLEAN DEFAULT false,
  show_on_list BOOLEAN DEFAULT true,
  show_on_create BOOLEAN DEFAULT true,
  show_on_edit BOOLEAN DEFAULT true,
  show_on_detail BOOLEAN DEFAULT true,
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

-- Validation rules table
CREATE TABLE metadata.validations (
  id SERIAL PRIMARY KEY,
  table_name NAME NOT NULL,
  column_name NAME NOT NULL,
  validation_type TEXT NOT NULL,  -- 'required', 'min', 'max', 'minLength', 'maxLength', 'pattern'
  validation_value TEXT,           -- e.g., '0', '100', '^\d{5}$'
  error_message TEXT NOT NULL,     -- User-friendly: "Age must be at least 18"
  sort_order INT DEFAULT 0,
  UNIQUE(table_name, column_name, validation_type)
);

-- CHECK constraint error message mapping
CREATE TABLE metadata.constraint_messages (
  id SERIAL PRIMARY KEY,
  constraint_name NAME NOT NULL UNIQUE,
  table_name NAME NOT NULL,
  column_name NAME,                -- NULL for multi-column constraints
  error_message TEXT NOT NULL
);

-- Grant permissions on metadata schema
GRANT USAGE ON SCHEMA metadata TO web_anon, authenticated;
GRANT SELECT ON metadata.entities TO web_anon, authenticated;
GRANT UPDATE, INSERT ON metadata.entities TO authenticated;
GRANT SELECT ON metadata.properties TO web_anon, authenticated;
GRANT SELECT ON metadata.permissions TO web_anon, authenticated;
GRANT SELECT ON metadata.roles TO web_anon, authenticated;
GRANT SELECT ON metadata.permission_roles TO web_anon, authenticated;
GRANT SELECT ON metadata.validations TO web_anon, authenticated;
GRANT SELECT ON metadata.constraint_messages TO web_anon, authenticated;

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
  COALESCE(entities.display_name, tables.table_name::text) AS display_name,
  COALESCE(entities.sort_order, 0) AS sort_order,
  entities.description,
  entities.search_fields,
  tables.table_name,
  public.has_permission(tables.table_name::text, 'create') AS insert,
  public.has_permission(tables.table_name::text, 'read') AS "select",
  public.has_permission(tables.table_name::text, 'update') AS update,
  public.has_permission(tables.table_name::text, 'delete') AS delete
FROM information_schema.tables
LEFT JOIN metadata.entities ON entities.table_name = tables.table_name::name
WHERE tables.table_schema::name = 'public'::name
  AND tables.table_type::text = 'BASE TABLE'::text
  AND tables.table_name::name <> ALL (ARRAY['civic_os_users'::name, 'civic_os_users_private'::name])
ORDER BY COALESCE(entities.sort_order, 0), tables.table_name;

ALTER VIEW public.schema_entities SET (security_invoker = true);

GRANT SELECT ON public.schema_entities TO web_anon, authenticated;

-- =====================================================
-- Schema Properties View
-- =====================================================

CREATE OR REPLACE VIEW public.schema_properties AS
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
  COALESCE(properties.sortable, true) AS sortable,
  COALESCE(properties.filterable, false) AS filterable,
  -- Smart defaults: system fields hidden by default, but can be overridden via metadata
  COALESCE(properties.show_on_list,
    CASE WHEN columns.column_name::text IN ('id', 'civic_os_text_search', 'created_at', 'updated_at')
      THEN false
      ELSE true
    END
  ) AS show_on_list,
  COALESCE(properties.show_on_create,
    CASE WHEN columns.column_name::text IN ('id', 'civic_os_text_search', 'created_at', 'updated_at')
      THEN false
      ELSE true
    END
  ) AS show_on_create,
  COALESCE(properties.show_on_edit,
    CASE WHEN columns.column_name::text IN ('id', 'civic_os_text_search', 'created_at', 'updated_at')
      THEN false
      ELSE true
    END
  ) AS show_on_edit,
  COALESCE(properties.show_on_detail,
    CASE WHEN columns.column_name::text IN ('id', 'civic_os_text_search') THEN false
         WHEN columns.column_name::text IN ('created_at', 'updated_at') THEN true
         ELSE true
    END
  ) AS show_on_detail,
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
  relations.join_column,
  -- Extract geography/geometry subtype (e.g., 'Point' from 'geography(Point,4326)')
  CASE
    WHEN columns.udt_name::text IN ('geography', 'geometry') THEN
      SUBSTRING(
        pg_type_info.formatted_type
        FROM '\(([A-Za-z]+)'
      )
    ELSE NULL
  END AS geography_type,
  -- Validation rules as JSONB array
  COALESCE(
    validation_rules_agg.validation_rules,
    '[]'::jsonb
  ) AS validation_rules
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
LEFT JOIN (
  SELECT
    c.relname AS table_name,
    a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS formatted_type
  FROM pg_attribute a
  JOIN pg_class c ON a.attrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND a.attnum > 0
    AND NOT a.attisdropped
) pg_type_info
  ON pg_type_info.table_name = columns.table_name::name
  AND pg_type_info.column_name = columns.column_name::name
LEFT JOIN (
  SELECT
    table_name,
    column_name,
    jsonb_agg(
      jsonb_build_object(
        'type', validation_type,
        'value', validation_value,
        'message', error_message
      )
      ORDER BY sort_order
    ) AS validation_rules
  FROM metadata.validations
  GROUP BY table_name, column_name
) validation_rules_agg
  ON validation_rules_agg.table_name = columns.table_name::name
  AND validation_rules_agg.column_name = columns.column_name::name
WHERE columns.table_schema::name = 'public'::name
  AND columns.table_name::name IN (
    SELECT schema_entities.table_name FROM schema_entities
  );

ALTER VIEW public.schema_properties SET (security_invoker = true);

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
-- Entity Management RPC Functions
-- =====================================================

-- Upsert entity metadata (admin only)
CREATE OR REPLACE FUNCTION public.upsert_entity_metadata(
  p_table_name NAME,
  p_display_name TEXT,
  p_description TEXT,
  p_sort_order INT,
  p_search_fields TEXT[] DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Upsert the entity metadata
  INSERT INTO metadata.entities (table_name, display_name, description, sort_order, search_fields)
  VALUES (p_table_name, p_display_name, p_description, p_sort_order, p_search_fields)
  ON CONFLICT (table_name) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        search_fields = EXCLUDED.search_fields;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.upsert_entity_metadata(NAME, TEXT, TEXT, INT, TEXT[]) TO authenticated;

-- Update entity sort order (admin only)
CREATE OR REPLACE FUNCTION public.update_entity_sort_order(
  p_table_name NAME,
  p_sort_order INT
)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Update or insert with just sort_order
  INSERT INTO metadata.entities (table_name, sort_order)
  VALUES (p_table_name, p_sort_order)
  ON CONFLICT (table_name) DO UPDATE
    SET sort_order = EXCLUDED.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_entity_sort_order(NAME, INT) TO authenticated;

-- Upsert property metadata (admin only)
CREATE OR REPLACE FUNCTION public.upsert_property_metadata(
  p_table_name NAME,
  p_column_name NAME,
  p_display_name TEXT,
  p_description TEXT,
  p_sort_order INT,
  p_column_width INT,
  p_sortable BOOLEAN,
  p_filterable BOOLEAN,
  p_show_on_list BOOLEAN,
  p_show_on_create BOOLEAN,
  p_show_on_edit BOOLEAN,
  p_show_on_detail BOOLEAN
)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Upsert the property metadata
  INSERT INTO metadata.properties (
    table_name,
    column_name,
    display_name,
    description,
    sort_order,
    column_width,
    sortable,
    filterable,
    show_on_list,
    show_on_create,
    show_on_edit,
    show_on_detail
  )
  VALUES (
    p_table_name,
    p_column_name,
    p_display_name,
    p_description,
    p_sort_order,
    p_column_width,
    p_sortable,
    p_filterable,
    p_show_on_list,
    p_show_on_create,
    p_show_on_edit,
    p_show_on_detail
  )
  ON CONFLICT (table_name, column_name) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order,
        column_width = EXCLUDED.column_width,
        sortable = EXCLUDED.sortable,
        filterable = EXCLUDED.filterable,
        show_on_list = EXCLUDED.show_on_list,
        show_on_create = EXCLUDED.show_on_create,
        show_on_edit = EXCLUDED.show_on_edit,
        show_on_detail = EXCLUDED.show_on_detail;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.upsert_property_metadata(NAME, NAME, TEXT, TEXT, INT, INT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- Update property sort order (admin only)
CREATE OR REPLACE FUNCTION public.update_property_sort_order(
  p_table_name NAME,
  p_column_name NAME,
  p_sort_order INT
)
RETURNS void AS $$
BEGIN
  -- Check if user is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Update or insert with smart defaults for system fields
  -- This prevents drag-and-drop reordering from overriding smart defaults with table defaults
  INSERT INTO metadata.properties (
    table_name,
    column_name,
    sort_order,
    filterable,
    show_on_list,
    show_on_create,
    show_on_edit,
    show_on_detail
  )
  VALUES (
    p_table_name,
    p_column_name,
    p_sort_order,
    -- Filterable defaults to false (opt-in)
    false,
    -- Smart defaults: same logic as schema_properties view
    CASE WHEN p_column_name IN ('id', 'civic_os_text_search', 'created_at', 'updated_at') THEN false ELSE true END,
    CASE WHEN p_column_name IN ('id', 'civic_os_text_search', 'created_at', 'updated_at') THEN false ELSE true END,
    CASE WHEN p_column_name IN ('id', 'civic_os_text_search', 'created_at', 'updated_at') THEN false ELSE true END,
    CASE WHEN p_column_name IN ('id', 'civic_os_text_search') THEN false
         WHEN p_column_name IN ('created_at', 'updated_at') THEN true
         ELSE true END
  )
  ON CONFLICT (table_name, column_name) DO UPDATE
    SET sort_order = EXCLUDED.sort_order;
    -- Note: Don't update show_on_* or filterable flags to preserve user customizations
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.update_property_sort_order(NAME, NAME, INT) TO authenticated;

-- =====================================================
-- Grant schema permissions
-- =====================================================

GRANT USAGE ON SCHEMA public TO web_anon, authenticated;
GRANT SELECT ON public.civic_os_users TO web_anon, authenticated;
GRANT SELECT ON public.civic_os_users_private TO web_anon, authenticated;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
