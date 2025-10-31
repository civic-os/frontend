-- Deploy civic-os:v0-8-2-fix-schema-relations-cross-schema-bug to pg
-- requires: v0-6-0-add-phone-jwt-sync

BEGIN;

-- =====================================================
-- Fix schema_relations_func() Cross-Schema FK Bug
-- =====================================================
--
-- Problem: The function incorrectly matches FKs across schemas when table
-- names collide. For example, a FK to public.projects(id) would also match
-- metadata.projects.project (Sqitch's internal table), creating duplicate
-- entries in schema_properties.
--
-- Root Cause: The join to constraint_column_usage only matches on
-- constraint_name without also matching constraint_schema, allowing
-- cross-schema false positives.
--
-- Fix: Add constraint_schema to the join condition to ensure we only
-- match the FK's actual target schema, not all schemas with matching
-- constraint names.

CREATE OR REPLACE FUNCTION public.schema_relations_func()
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
    ON r_c.unique_constraint_name::name = c_c_u.constraint_name::name
    AND r_c.unique_constraint_schema::name = c_c_u.constraint_schema::name;  -- FIX: Also match schema
$BODY$;

COMMIT;
