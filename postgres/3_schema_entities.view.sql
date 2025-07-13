CREATE OR REPLACE VIEW public.schema_entities
 AS
 SELECT COALESCE(entities.display_name, grants.table_name::text) AS display_name,
    COALESCE(entities.sort_order, 0) AS sort_order,
    entities.description,
    grants.table_name,
    grants.insert,
    grants."select",
    grants.update,
    grants.delete
   FROM ( SELECT role_table_grants.table_name,
            bool_or(role_table_grants.privilege_type::text = 'INSERT'::text) AS insert,
            bool_or(role_table_grants.privilege_type::text = 'SELECT'::text) AS "select",
            bool_or(role_table_grants.privilege_type::text = 'UPDATE'::text) AS update,
            bool_or(role_table_grants.privilege_type::text = 'DELETE'::text) AS delete
           FROM information_schema.role_table_grants
             JOIN information_schema.tables ON role_table_grants.table_schema::name = tables.table_schema::name AND role_table_grants.table_name::name = tables.table_name::name
          WHERE role_table_grants.table_schema::name = 'public'::name AND role_table_grants.grantee::name = CURRENT_ROLE AND tables.table_type::text = 'BASE TABLE'::text
          GROUP BY role_table_grants.grantee, role_table_grants.table_name) grants
     LEFT JOIN metadata.entities ON entities.table_name = grants.table_name::name
  WHERE grants.table_name::name <> ALL (ARRAY['civic_os_users'::name, 'civic_os_users_private'::name])
  ORDER BY (COALESCE(entities.sort_order, 0)), grants.table_name;

ALTER TABLE
	public.schema_entities OWNER TO postgres;

GRANT
SELECT
	ON TABLE public.schema_entities TO anon;

GRANT
SELECT
	ON TABLE public.schema_entities TO authenticated;

GRANT
SELECT
	ON TABLE public.schema_entities TO postgres;

GRANT
SELECT
	ON TABLE public.schema_entities TO service_role;

NOTIFY pgrst,
'reload schema';