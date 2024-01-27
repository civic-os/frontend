CREATE OR REPLACE VIEW public.schema_entities
WITH (
  security_invoker=true
) AS
 SELECT role_table_grants.grantee,
    role_table_grants.table_name AS display_name,
    0 AS sort_order,
    role_table_grants.table_name,
    bool_or(role_table_grants.privilege_type::text = 'INSERT'::text) AS insert,
    bool_or(role_table_grants.privilege_type::text = 'SELECT'::text) AS "select",
    bool_or(role_table_grants.privilege_type::text = 'UPDATE'::text) AS update,
    bool_or(role_table_grants.privilege_type::text = 'DELETE'::text) AS delete
   FROM information_schema.role_table_grants
     JOIN information_schema.tables ON role_table_grants.table_schema::name = tables.table_schema::name AND role_table_grants.table_name::name = tables.table_name::name
  WHERE role_table_grants.table_schema::name = 'public'::name AND role_table_grants.grantee::name = CURRENT_ROLE AND tables.table_type::text = 'BASE TABLE'::text
  GROUP BY role_table_grants.grantee, role_table_grants.table_name;

ALTER TABLE public.schema_entities
    OWNER TO postgres;

GRANT SELECT ON TABLE public.schema_entities TO anon;
GRANT SELECT ON TABLE public.schema_entities TO authenticated;
GRANT SELECT ON TABLE public.schema_entities TO postgres;
GRANT SELECT ON TABLE public.schema_entities TO service_role;