CREATE OR REPLACE VIEW public.schema_properties
WITH (
  security_invoker=true
) AS
 SELECT columns.table_catalog,
    columns.table_schema,
    columns.table_name,
    columns.column_name,
    initcap(replace(columns.column_name::text, '_'::text, ' '::text)) AS display_name,
    columns.ordinal_position AS sort_order,
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
     LEFT JOIN (SELECT * FROM public.schema_relations_func()) relations ON columns.table_schema::name = relations.src_schema::name AND columns.table_name::name = relations.src_table::name AND columns.column_name::name = relations.src_column::name
  WHERE columns.table_schema::name = 'public'::name AND (columns.table_name::name IN ( SELECT schema_tables.table_name
           FROM schema_tables));

ALTER TABLE public.schema_properties
    OWNER TO postgres;

GRANT SELECT ON TABLE public.schema_properties TO anon;
GRANT SELECT ON TABLE public.schema_properties TO authenticated;
GRANT SELECT ON TABLE public.schema_properties TO postgres;
GRANT SELECT ON TABLE public.schema_properties TO service_role;