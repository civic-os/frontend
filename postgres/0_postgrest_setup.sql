-- =====================================================
-- PostgREST Role Setup
-- =====================================================

-- Create PostgREST roles
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'securepassword123';

-- Grant role switching to authenticator
GRANT web_anon TO authenticator;
GRANT authenticated TO authenticator;

-- =====================================================
-- JWT Helper Functions (Keycloak Integration)
-- =====================================================

-- Get current user ID from JWT 'sub' claim
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Get user email from JWT 'email' claim
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'email';
$$ LANGUAGE SQL STABLE;

-- Get user name from JWT 'name' or 'preferred_username' claim
CREATE OR REPLACE FUNCTION public.current_user_name()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'name',
    current_setting('request.jwt.claims', true)::json->>'preferred_username'
  );
$$ LANGUAGE SQL STABLE;

-- Check JWT and set role
CREATE OR REPLACE FUNCTION public.check_jwt()
RETURNS VOID AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::json->>'sub' IS NOT NULL THEN
    EXECUTE 'SET LOCAL ROLE authenticated';
  ELSE
    EXECUTE 'SET LOCAL ROLE web_anon';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
