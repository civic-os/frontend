-- Verify civic-os:v0-8-2-fix-schema-relations-cross-schema-bug on pg

BEGIN;

-- Verify the function exists and is callable
SELECT has_function_privilege('public.schema_relations_func()', 'execute');

-- Verify the function returns the expected columns
SELECT
  src_schema,
  src_table,
  src_column,
  constraint_schema,
  constraint_name,
  join_schema,
  join_table,
  join_column
FROM public.schema_relations_func()
WHERE FALSE;  -- Don't actually return rows, just verify structure

-- Verify the function properly filters by join_schema
-- All returned FKs should have join_schema and constraint_schema matching
-- (This tests that cross-schema constraint matching is working correctly)
DO $$
DECLARE
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM public.schema_relations_func()
  WHERE join_schema != constraint_schema;

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'schema_relations_func() returned % FKs with mismatched join_schema and constraint_schema', mismatch_count;
  END IF;
END $$;

ROLLBACK;
