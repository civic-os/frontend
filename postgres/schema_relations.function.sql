CREATE FUNCTION public.schema_relations_func()
    RETURNS TABLE (src_schema NAME, src_table NAME, src_column NAME, constraint_schema NAME, constraint_name NAME, join_schema NAME, join_table NAME, join_column NAME)
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

ALTER FUNCTION public.schema_relations_func()
    OWNER TO postgres;