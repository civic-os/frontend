-- Create additional roles
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'securepassword';
CREATE ROLE api_user NOLOGIN;

-- Grant necessary permissions
GRANT web_anon TO authenticator;
GRANT api_user TO authenticator;

-- Create API schema
CREATE SCHEMA api;
GRANT USAGE ON SCHEMA api TO web_anon, api_user;

-- Example table
CREATE TABLE api.todos (
  id SERIAL PRIMARY KEY,
  task TEXT NOT NULL,
  completed BOOLEAN DEFAULT false
);

GRANT SELECT ON api.todos TO web_anon;
GRANT ALL ON api.todos TO api_user;
GRANT USAGE ON SEQUENCE api.todos_id_seq TO api_user;

-- Function to get current user (for OIDC integration)
CREATE OR REPLACE FUNCTION api.current_user_id() 
RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claim.sub', true) 
  WHERE current_setting('request.jwt.claim.sub', true) IS NOT NULL
$$ LANGUAGE SQL STABLE;

-- Set up additional configurations for OIDC
ALTER ROLE authenticator SET pgrst.jwt_secret = '${JWT_SECRET:-defaultFallbackSecretMinimum32CharactersLong}';
ALTER ROLE authenticator SET pgrst.jwt_aud = '${JWT_AUDIENCE:-your-audience}';