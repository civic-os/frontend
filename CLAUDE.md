# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Civic OS is a meta-application framework that automatically generates CRUD (Create, Read, Update, Delete) views for any PostgreSQL database schema. The Angular frontend dynamically creates list, detail, create, and edit pages based on database metadata stored in custom PostgreSQL views.

**Key Concept**: Instead of manually building UI for each table, Civic OS reads database schema metadata from `schema_entities` and `schema_properties` views to automatically generate forms, tables, and validation.

## Architecture

### Core Data Flow
1. **Database Schema** → PostgreSQL metadata tables (`metadata.entities`, `metadata.properties`)
2. **Metadata Views** → `schema_entities` and `schema_properties` views aggregate database structure
3. **SchemaService** → Fetches metadata and determines property types (text, number, foreign key, etc.)
4. **DataService** → Performs CRUD operations via PostgREST API
5. **Dynamic Pages** → List/Detail/Create/Edit pages render based on schema metadata
6. **Smart Components** → `DisplayPropertyComponent` and `EditPropertyComponent` adapt to property types

### Key Services

**SchemaService** (`src/app/services/schema.service.ts`)
- Fetches and caches entity and property metadata
- Determines property types from PostgreSQL data types (e.g., `int4` with `join_column` → `ForeignKeyName`)
- Filters properties for different contexts (list, detail, create, edit)
- Hides system fields: `id`, `created_at`, `updated_at`

**DataService** (`src/app/services/data.service.ts`)
- Abstracts PostgREST API calls
- Builds query strings with select fields, ordering, and filters
- Handles error responses and provides human-readable messages

**AuthService** (`src/app/services/auth.service.ts`)
- Integrates with Keycloak for authentication
- Uses `keycloak-angular` library

### Routing Pattern

Routes are entity-driven using `entityKey` parameter:
- `/view/:entityKey` → List all records
- `/view/:entityKey/:entityId` → Detail view
- `/create/:entityKey` → Create form
- `/edit/:entityKey/:entityId` → Edit form

### Property Type System

The `EntityPropertyType` enum maps PostgreSQL types to UI components:
- `ForeignKeyName`: Integer/UUID with `join_column` → Dropdown with related entity's display_name
- `User`: UUID with `join_table = 'civic_os_users'` → User display component
- `DateTime`, `DateTimeLocal`, `Date`: Timestamp types → Date/time inputs
- `Boolean`: `bool` → Checkbox
- `Money`: `money` → Currency input (ngx-currency)
- `IntegerNumber`: `int4`/`int8` → Number input
- `TextShort`: `varchar` → Text input
- `TextLong`: `text` → Textarea

## Development Commands

### Daily Development
```bash
# Start dev server (runs on http://localhost:4200)
npm start
# or
ng serve

# Run in watch mode with live rebuild
npm run watch
```

### Testing
```bash
# Run all unit tests
npm test
# or
ng test

# Run specific test file
ng test --include='**/schema.service.spec.ts'
```

### Build
```bash
# Production build
npm run build
# or
ng build

# Development build with source maps
ng build --configuration development
```

### Code Generation
```bash
# Generate new component
ng generate component components/component-name

# Generate new service
ng generate service services/service-name

# Generate page (use "page" suffix by convention)
ng generate component pages/page-name --type=page
```

## Database Setup

### Local Development with Docker Compose

The project uses Docker Compose to run PostgreSQL 17 with PostGIS 3.5 and PostgREST locally with Keycloak authentication.

```bash
# Navigate to example folder
cd example

# Configure environment (first time only)
cp .env.example .env
# Edit .env and set your database password

# Fetch Keycloak public key (first time only)
./fetch-keycloak-jwk.sh

# Start Docker services
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs if needed
docker-compose logs -f postgres
docker-compose logs -f postgrest
```

The database initialization script (`example/init-scripts/00_init.sh`) runs all SQL files from the `postgres/` directory in alphabetical order, which automatically creates:
- PostgREST roles (`web_anon`, `authenticated`) - `postgres/0_postgrest_setup.sql`
- RBAC functions (`get_user_roles()`, `has_permission()`, `is_admin()`) - `postgres/1_rbac_functions.sql`
- Civic OS user tables (`civic_os_users`, `civic_os_users_private`) - `postgres/2_civic_os_schema.sql`
- Metadata schema (`metadata.entities`, `metadata.properties`, `metadata.roles`, `metadata.permissions`, etc.) - `postgres/2_civic_os_schema.sql`
- Dynamic views (`schema_entities`, `schema_properties`) - `postgres/2_civic_os_schema.sql`
- Default roles and sample permissions - `postgres/3_rbac_sample_data.sql`
- Example application (Pot Hole Observation System) - `example/init-scripts/01_pot_hole_schema.sql` and `02_pot_hole_data.sql`

The Pot Hole Observation System serves as a reference implementation, demonstrating tables for issue tracking, work packages, bids, and status management.

### Database Schema Updates

**IMPORTANT**: Docker init scripts only run when the database is **first created**. If you modify SQL files in `postgres/` after the database has been initialized, you must either:

1. **Recreate the database** (recommended for development):
   ```bash
   cd example
   docker-compose down -v  # -v removes volumes
   docker-compose up -d
   ```

2. **Apply changes manually** to running database:
   ```bash
   docker exec postgres_db psql -U postgres -d civic_os_db -f /civic-os-core/your-file.sql
   docker exec postgres_db psql -U postgres -d civic_os_db -c "NOTIFY pgrst, 'reload schema';"
   ```

**PostgreSQL View Creation Syntax**: When creating views with `security_invoker` option, use separate statements:
```sql
-- ✅ Correct: Use ALTER VIEW after creation
CREATE OR REPLACE VIEW public.my_view AS SELECT ...;
ALTER VIEW public.my_view SET (security_invoker = true);

-- ❌ Incorrect: WITH clause silently fails in PostgreSQL 15
CREATE OR REPLACE VIEW public.my_view WITH (security_invoker = true) AS SELECT ...;
```

### Environment Configuration
- **Development**: `src/environments/environment.development.ts` - Points to `http://localhost:3000/` (Docker PostgREST)
- **Production**: `src/environments/environment.ts` - Configure before deployment

## PostgREST Integration

All API calls use PostgREST conventions:
- **Select fields**: `?select=id,name,created_at`
- **Embedded resources**: `?select=id,author:users(display_name)`
- **Filters**: `?id=eq.5`
- **Ordering**: `?order=created_at.desc`

The `SchemaService.propertyToSelectString()` method builds PostgREST-compatible select strings for foreign keys and user references.

## Authentication

- Uses **Keycloak** via `keycloak-angular` library
- Configuration in `src/app/app.config.ts`:
  - Keycloak URL: `https://auth.civic-os.org`
  - Realm: `civic-os-dev`
  - Client ID: `myclient`
- Bearer token automatically included for requests to `localhost:3000` via `includeBearerTokenInterceptor`

## Role-Based Access Control (RBAC)

### Database-Driven Permissions

Civic OS uses a flexible RBAC system where permissions are stored in the database:

- **Roles** (`metadata.roles`): Defines user roles (e.g., `anonymous`, `user`, `editor`, `admin`)
- **Permissions** (`metadata.permissions`): Defines table-level CRUD permissions (`create`, `read`, `update`, `delete`)
- **Permission Roles** (`metadata.permission_roles`): Junction table mapping roles to permissions

### Default Roles

The system comes with four predefined roles (defined in `postgres/3_rbac_sample_data.sql`):
- `anonymous` - Unauthenticated users
- `user` - Standard authenticated user
- `editor` - Can create and edit content
- `admin` - Full administrative access (required for permissions management UI)

### Configuring Keycloak Roles

For roles to work, you must configure Keycloak to include role claims in JWT tokens:

1. **Access Keycloak Admin Console**
   - Navigate to `https://auth.civic-os.org` (or your Keycloak URL)
   - Login with admin credentials
   - Select the `civic-os-dev` realm

2. **Create Realm Roles**
   - Go to **Realm Roles** → **Create Role**
   - Create roles matching database roles: `user`, `editor`, `admin`
   - The `anonymous` role is automatically assigned by the backend for unauthenticated requests

3. **Assign Roles to Users**
   - Go to **Users** → Select your user
   - Click **Role Mapping** tab
   - Click **Assign Role**
   - Select roles (e.g., `admin`) and click **Assign**

4. **Configure Client Scopes** (if roles aren't appearing in JWT)
   - Go to **Client Scopes** → **roles** → **Mappers** tab
   - Ensure there's a mapper with:
     - Mapper Type: `User Realm Role`
     - Token Claim Name: `realm_access.roles` or `roles`
     - Add to ID token: ON
     - Add to access token: ON
     - Add to userinfo: ON

5. **Verify JWT Token Contents**
   - After logging in, check browser console for JWT token
   - Or use `jwt.io` to decode your access token
   - Ensure roles appear in token payload under `realm_access.roles` or `roles`

### How Roles Work in Civic OS

**Backend (PostgreSQL)**:
- `public.get_user_roles()` extracts roles from JWT claims
- `public.has_permission(table_name, permission)` checks if user's roles grant access
- `public.is_admin()` checks if user has the `admin` role
- Row Level Security (RLS) policies use these functions to enforce permissions

**Frontend (Angular)**:
- `AuthService.userRoles` populated from Keycloak JWT on login
- `AuthService.hasRole(roleName)` checks for specific role
- `AuthService.isAdmin()` checks for admin role
- UI elements conditionally rendered based on roles

### Managing Permissions (Admin Only)

Admins can manage role permissions via the **Permissions** page (`/permissions`):
1. Login as a user with the `admin` role
2. Open the left menu and click **Permissions** under the Admin section
3. Select a role from the dropdown
4. Toggle checkboxes to grant/revoke CRUD permissions for each table
5. Changes are saved automatically

**Note**: The Permissions page requires the `admin` role both at the database level (`public.is_admin()` check) and in the UI (menu visibility).

**Troubleshooting**: If you encounter issues with RBAC, such as JWT roles not being recognized or permissions not working correctly, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed debugging steps and common solutions.

## Styling

- **Tailwind CSS** for utility classes
- **DaisyUI** component library (themes: light, dark, corporate, nord, emerald)
- Global styles in `src/styles.css`
- Component-specific styles use standalone CSS files

## TypeScript Configuration

- Strict mode enabled
- `experimentalDecorators: true` for Angular decorators
- Target: ES2022
- Module resolution: bundler

## Common Patterns

### Adding a New Entity to the UI
1. Create table in PostgreSQL `public` schema
2. Add entry to `metadata.entities` table (optional, for custom display_name and sort_order)
3. Add entries to `metadata.properties` table (optional, for custom labels and ordering)
4. Grant appropriate permissions (INSERT, SELECT, UPDATE, DELETE)
5. Navigate to `/view/your_table_name` - UI auto-generates

### Custom Property Display
- Override `metadata.properties.display_name` to change label
- Set `metadata.properties.sort_order` to control field ordering
- Use `metadata.properties.column_width` for layout hints (not yet implemented in UI)

### Adding Form Validation
- Extend `SchemaService.getFormValidatorsForProperty()` to add Angular validators based on property metadata
- Currently only implements `Validators.required` for non-nullable columns

### Handling New Property Types
1. Add new type to `EntityPropertyType` enum
2. Update `SchemaService.getPropertyType()` to detect the type
3. Add rendering logic to `DisplayPropertyComponent`
4. Add input control to `EditPropertyComponent`
