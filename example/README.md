# Civic OS - Docker Setup (Keycloak Authentication)

This folder contains a Docker Compose setup for running Civic OS with PostgreSQL, PostgREST, and Keycloak authentication, replacing the Supabase-based setup.

## Prerequisites

- Docker and Docker Compose installed
- Keycloak server running at `https://auth.civic-os.org` (or update `.env` with your Keycloak URL)
- Keycloak realm configured with a client for this application

## Architecture

```
Frontend (Angular) → PostgREST (Port 3000) → PostgreSQL
                            ↓
                     Keycloak JWT Validation
```

- **PostgreSQL**: Database with Civic OS metadata schema
- **PostgREST**: REST API layer with JWT authentication
- **Keycloak**: Identity provider (external, not in Docker)

## Setup Instructions

### 1. Configure Keycloak

In your Keycloak admin console:

1. Create or use existing realm (e.g., `civic-os-dev`)
2. Create a client (e.g., `myclient`)
3. Configure client settings:
   - Access Type: `public` (for frontend)
   - Valid Redirect URIs: `http://localhost:4200/*`
   - Web Origins: `http://localhost:4200`
4. Get the realm's public key:
   - Go to: **Realm Settings → Keys → RS256 → Public key**
   - Copy the public key value

### 2. Configure Environment Variables

Copy the example environment file and edit it:

```bash
cd example-2
cp .env.example .env
```

Then edit `.env` and set your database password:

```bash
# Database Configuration
POSTGRES_DB=civic_os_db
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE  # Change this!

# Keycloak Settings (update if needed)
KEYCLOAK_URL=https://auth.civic-os.org
KEYCLOAK_REALM=civic-os-dev
KEYCLOAK_CLIENT_ID=myclient
```

### 3. Fetch Keycloak Public Key (JWKS)

Run the provided script to automatically fetch the public key from Keycloak:

```bash
cd example-2
./fetch-keycloak-jwk.sh
```

This script:
- Fetches the JWKS from Keycloak
- Extracts the RS256 public key
- Saves it as `jwt-secret.jwks` in JWKS format (required by PostgREST)

**Manual Method**: If you prefer to fetch manually:
```bash
curl -s "https://auth.civic-os.org/realms/civic-os-dev/protocol/openid-connect/certs" | \
  jq '{keys: [.keys[] | select(.alg=="RS256") | {kid, kty, alg, use, n, e}]}' > jwt-secret.jwks
```

### 4. Start the Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port `15432` (mapped to avoid conflicts with local PostgreSQL)
- PostgREST on port `3000`
- Swagger UI on port `8080` (optional, for API docs)

### 5. Verify Setup

Check that all services are running:

```bash
docker-compose ps
```

Test PostgREST API:

```bash
curl http://localhost:3000/schema_entities
```

### 6. Configure Frontend

The frontend is already configured to use this setup:
- `src/environments/environment.development.ts` points to `http://localhost:3000/`
- `src/app/app.config.ts` includes Keycloak configuration

### 7. Run the Frontend

```bash
cd ..  # Back to project root
npm start
```

The app will be available at `http://localhost:4200`

## Database Schema

The initialization script (`init-scripts/init.sql`) creates:

### Core Civic OS Tables
- `public.civic_os_users` - Public user information
- `public.civic_os_users_private` - Private user information (RLS protected)

### Metadata Schema
- `metadata.entities` - Entity metadata (table display names, descriptions)
- `metadata.properties` - Property metadata (column display names, sort order)
- `metadata.permissions` - Permission definitions
- `metadata.roles` - Role definitions
- `metadata.permission_roles` - Permission-role mappings

### Dynamic Views
- `public.schema_entities` - Lists all entities based on permissions
- `public.schema_properties` - Lists all properties with metadata

## Authentication Flow

1. User logs in via Keycloak (frontend redirects to Keycloak)
2. Keycloak returns JWT token with claims (`sub`, `email`, `name`, etc.)
3. Frontend sends JWT in `Authorization: Bearer <token>` header
4. PostgREST validates JWT using Keycloak's JWKS endpoint (automatically fetches public keys)
5. `public.check_jwt()` function runs on each request:
   - If JWT has `sub` claim → set role to `authenticated`
   - Otherwise → set role to `web_anon`
6. Row Level Security (RLS) policies enforce access control

**Note**: The `jwt-secret.jwks` file contains Keycloak's public key in JWKS format. If Keycloak rotates its keys, you'll need to re-run `./fetch-keycloak-jwk.sh` and restart PostgREST (`docker-compose restart postgrest`).

## JWT Helper Functions

The database includes helper functions to access JWT claims:

- `public.current_user_id()` - Returns UUID from `sub` claim
- `public.current_user_email()` - Returns email from `email` claim
- `public.current_user_name()` - Returns name from `name` or `preferred_username` claim

Use these in RLS policies and queries:

```sql
-- Example: Filter records to current user
CREATE POLICY "Users see own records"
  ON my_table
  FOR SELECT
  TO authenticated
  USING (user_id = public.current_user_id());
```

## Adding New Entities

1. Create your table in PostgreSQL:

```sql
CREATE TABLE public.my_entity (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID REFERENCES public.civic_os_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.my_entity TO authenticated;
GRANT USAGE ON SEQUENCE public.my_entity_id_seq TO authenticated;

-- Optional: Add RLS
ALTER TABLE public.my_entity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own entities"
  ON public.my_entity
  FOR ALL
  TO authenticated
  USING (user_id = public.current_user_id());
```

2. (Optional) Add metadata for better display:

```sql
INSERT INTO metadata.entities (table_name, display_name, description, sort_order)
VALUES ('my_entity', 'My Entity', 'Description of my entity', 10);

INSERT INTO metadata.properties (table_name, column_name, display_name, sort_order)
VALUES
  ('my_entity', 'name', 'Entity Name', 1),
  ('my_entity', 'user_id', 'Owner', 2);
```

3. Navigate to `http://localhost:4200/view/my_entity` - the UI auto-generates!

## User Sync (Manual Process)

Since Keycloak users are external, you need to manually sync users to `civic_os_users` table:

```sql
-- Insert user from Keycloak (use Keycloak user's UUID)
INSERT INTO public.civic_os_users (id, display_name)
VALUES ('keycloak-user-uuid-here', 'John Doe');

INSERT INTO public.civic_os_users_private (id, display_name, email, phone)
VALUES (
  'keycloak-user-uuid-here',
  'John Doe',
  'john@example.com',
  '+1234567890'
);
```

**Future Enhancement**: Create a webhook or service to automatically sync Keycloak users.

## Troubleshooting

### JWT Validation Fails

- Ensure `JWT_SECRET` in `.env` matches Keycloak's realm public key
- Check Keycloak token includes required claims (`sub`, `email`)
- Verify Keycloak client configuration allows the frontend origin

### PostgREST Connection Error

- Check PostgreSQL is running: `docker-compose logs postgres`
- Verify database credentials in `.env`
- Ensure init scripts ran successfully: `docker-compose logs postgres | grep ERROR`

### Schema Not Loading

- Check PostgREST logs: `docker-compose logs postgrest`
- Verify roles have correct permissions:
  ```bash
  docker-compose exec postgres psql -U postgres -d civic_os_db -c "\du"
  ```

### Reset Database

```bash
docker-compose down -v  # Remove volumes
docker-compose up -d    # Recreate with fresh database
```

## Stopping Services

```bash
docker-compose down
```

To remove volumes (delete all data):

```bash
docker-compose down -v
```

## API Documentation

Swagger UI is available at `http://localhost:8080` for interactive API documentation.

## Security Notes

1. **Change default passwords** in `.env` before production use
2. **Use HTTPS** for Keycloak and PostgREST in production
3. **Configure CORS** properly in PostgREST for production
4. **Review RLS policies** to ensure proper access control
5. **Rotate JWT secrets** periodically in Keycloak

## Differences from Supabase Setup

| Feature | Supabase | Docker Setup |
|---------|----------|--------------|
| Auth Provider | Supabase Auth | Keycloak |
| PostgREST Port | 54321 | 3000 |
| User Management | `auth.users` table | External (Keycloak) |
| JWT Claims | `auth.jwt()` | `request.jwt.claim.*` |
| User Sync | Automatic triggers | Manual (for now) |
| Admin UI | Supabase Studio | Swagger UI (API only) |
