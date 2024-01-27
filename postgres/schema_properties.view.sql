CREATE OR REPLACE VIEW public.schema_properties
WITH (
  security_invoker=true
) AS
 SELECT columns.table_catalog,
    columns.table_schema,
    columns.table_name,
    columns.column_name,
    COALESCE(properties.display_name, initcap(replace(columns.column_name::text, '_'::text, ' '::text))) AS display_name,
    properties.description,
    COALESCE(properties.sort_order, columns.ordinal_position::integer) AS sort_order,
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
     LEFT JOIN ( SELECT schema_relations_func.src_schema,
            schema_relations_func.src_table,
            schema_relations_func.src_column,
            schema_relations_func.constraint_schema,
            schema_relations_func.constraint_name,
            schema_relations_func.join_schema,
            schema_relations_func.join_table,
            schema_relations_func.join_column
           FROM schema_relations_func() schema_relations_func(src_schema, src_table, src_column, constraint_schema, constraint_name, join_schema, join_table, join_column)) relations ON columns.table_schema::name = relations.src_schema AND columns.table_name::name = relations.src_table AND columns.column_name::name = relations.src_column
     LEFT JOIN metadata.properties ON properties.table_name = columns.table_name::name AND properties.column_name = columns.column_name::name
  WHERE columns.table_schema::name = 'public'::name AND (columns.table_name::name IN ( SELECT schema_entities.table_name
           FROM schema_entities));

ALTER TABLE public.schema_properties
    OWNER TO postgres;

GRANT SELECT ON TABLE public.schema_properties TO anon;
GRANT SELECT ON TABLE public.schema_properties TO authenticated;
GRANT SELECT ON TABLE public.schema_properties TO postgres;
GRANT SELECT ON TABLE public.schema_properties TO service_role;