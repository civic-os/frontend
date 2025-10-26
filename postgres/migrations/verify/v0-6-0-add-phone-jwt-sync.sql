-- Verify civic_os:v0-6-0-add-phone-jwt-sync on pg
-- Verify phone JWT sync functions exist and work correctly

BEGIN;

-- Verify current_user_phone() function exists
SELECT has_function_privilege('public.current_user_phone()', 'execute');

-- Verify refresh_current_user() function exists
SELECT has_function_privilege('public.refresh_current_user()', 'execute');

-- Verify current_user_phone() returns a text value (or NULL)
DO $$
DECLARE
  v_phone TEXT;
BEGIN
  v_phone := public.current_user_phone();
  -- Function should work (may return NULL if not in JWT context)
  IF v_phone IS NOT NULL AND LENGTH(v_phone) = 0 THEN
    RAISE EXCEPTION 'current_user_phone() returned empty string instead of NULL';
  END IF;
END $$;

ROLLBACK;
