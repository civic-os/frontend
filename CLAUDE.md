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

### Key Components

**GeoPointMapComponent** (`src/app/components/geo-point-map/`)
- Reusable Leaflet map component for geography Point fields
- Supports both display (static) and edit (interactive) modes
- Handles WKT/EWKT parsing, marker placement, and user location
- Used by DisplayPropertyComponent and EditPropertyComponent for GeoPoint fields

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
- `GeoPoint`: `geography(Point, 4326)` → Interactive map (Leaflet) with location picker

#### Geography (GeoPoint) Type Requirements

**IMPORTANT**: When adding a geography column, you must create a paired computed field function for PostgREST to expose the data in a readable format.

**Pattern**: For each geography column `<column_name>`, create a function `<column_name>_text`:

```sql
-- Example: Issue table with location column
-- Note: PostGIS types must be schema-qualified in init scripts
CREATE TABLE "public"."Issue" (
  "location" postgis.geography(Point, 4326)
);

-- Required computed field function
-- Note: PostGIS functions must be schema-qualified in init scripts
CREATE OR REPLACE FUNCTION public.location_text("Issue")
RETURNS text AS $$
  SELECT postgis.ST_AsText($1.location);
$$ LANGUAGE SQL STABLE;

GRANT EXECUTE ON FUNCTION public.location_text("Issue") TO web_anon, authenticated;
```

**How it works**:
1. The computed field function converts geography to Well-Known Text format (e.g., `"POINT(-83.6875 43.0125)"`)
2. PostgREST automatically exposes `<column_name>_text` as a virtual computed field
3. The frontend's `SchemaService.propertyToSelectString()` detects GeoPoint types and selects `location:location_text` (using PostgREST aliasing)
4. Data returns with the original column name: `{"location": "POINT(-83.6875 43.0125)"}`
5. Display/edit components parse the WKT string to extract coordinates for the map

**Data format**:
- **Insert/Update**: Send EWKT string `"SRID=4326;POINT(lng lat)"`
- **Read**: Receive WKT string `"POINT(lng lat)"` (aliased to column name)

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
# Run all unit tests (watch mode - stays open)
npm test
# or
ng test

# Run tests once and exit (for CI/scripts)
npm test -- --no-watch --browsers=ChromeHeadless

# Run specific test file
ng test --include='**/schema.service.spec.ts'

# Run specific test file once and exit
ng test --include='**/schema.service.spec.ts' --no-watch --browsers=ChromeHeadless
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

### Mock Data Generation

The project includes a TypeScript-based mock data generator that creates realistic test data for demonstration and testing purposes.

**Features:**
- Reads schema metadata from PostgREST to auto-generate appropriate fake data
- Handles all property types (text, numbers, dates, foreign keys, users, geography points)
- Generates mock users (civic_os_users and civic_os_users_private) with matching UUIDs
- Respects foreign key dependencies and generates data in correct order
- Configurable number of records per entity
- Outputs SQL files or inserts directly into database

**Configuration:**

Edit `scripts/mock-data-config.json` to customize:
```json
{
  "recordsPerEntity": {
    "Issue": 25,
    "WorkPackage": 5,
    "Bid": 15
  },
  "geographyBounds": {
    "minLat": 42.25,
    "maxLat": 42.45,
    "minLng": -83.30,
    "maxLng": -82.90
  },
  "excludeTables": ["IssueStatus", "WorkPackageStatus"],
  "outputPath": "./example/init-scripts/03_mock_data.sql",
  "generateUsers": true,
  "userCount": 15
}
```

**Usage:**

```bash
# Load and export environment variables from Docker setup, then run generator
set -a && source example/.env && set +a && npm run generate:mock

# Or manually specify environment variables
POSTGRES_PASSWORD=your_password npm run generate:mock

# Insert data directly into running database
set -a && source example/.env && set +a && npm run generate:seed
```

**Important Notes:**
- Use `set -a` (allexport) before sourcing to export variables to npm's child process
- Plain `source` loads variables but doesn't export them to child processes
- Works reliably on both bash and zsh (macOS default shell since Catalina)
- Safely handles values with spaces, quotes, and special characters

**Data Generation by Property Type:**
- `display_name` → Domain-specific descriptions based on entity type:
  - **Issue**: "Large pothole on Main Street" (size + issue type + location)
  - **WorkPackage**: "Q2 2024 road repairs - Detroit" (period + year + area)
  - **Bid**: "ABC Construction proposal" (company name + "proposal")
  - **WorkDetail**: "Inspected damage extent and recommended materials" (action + finding)
- `TextShort` → Lorem ipsum words (3 words)
- `TextLong` → Paragraphs of lorem ipsum
- `IntegerNumber` → Random integers (1-1000)
- `Money` → Currency values ($10-$10,000)
- `Boolean` → Random true/false
- `Date`/`DateTime` → Recent dates (last 30 days)
- `ForeignKeyName` → Random selection from related table
- `User` → Random selection from civic_os_users
- `GeoPoint` → Random coordinates within configured bounds (EWKT format)

**Note**: The `display_name` generator can be customized by editing the `generateDisplayName()` method in `scripts/generate-mock-data.ts`. See `scripts/README.md` for Faker API reference and examples.

**Integration with Docker:**

The generated SQL file (`03_mock_data.sql`) can be placed in `example/init-scripts/` to automatically populate the database when Docker Compose creates the PostgreSQL container. Remember to recreate the database volume to apply changes:

```bash
cd example
docker-compose down -v
docker-compose up -d
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
- PostGIS extension in dedicated schema - `postgres/0_postgis_setup.sql`
- PostgREST roles (`web_anon`, `authenticated`) - `postgres/1_postgrest_setup.sql`
- RBAC functions (`get_user_roles()`, `has_permission()`, `is_admin()`) - `postgres/2_rbac_functions.sql`
- Civic OS user tables (`civic_os_users`, `civic_os_users_private`) - `postgres/3_civic_os_schema.sql`
- Metadata schema (`metadata.entities`, `metadata.properties`, `metadata.roles`, `metadata.permissions`, etc.) - `postgres/3_civic_os_schema.sql`
- Dynamic views (`schema_entities`, `schema_properties`) - `postgres/3_civic_os_schema.sql`
- Default roles and sample permissions - `postgres/4_rbac_sample_data.sql`
- Example application (Pot Hole Observation System) - `example/init-scripts/01_pot_hole_schema.sql` and `02_pot_hole_data.sql`

The Pot Hole Observation System serves as a reference implementation, demonstrating tables for issue tracking, work packages, bids, and status management.

#### PostGIS Schema Separation

PostGIS is installed in a dedicated `postgis` schema (not `public`) to keep the public schema clean and make application functions easier to find. This separation:
- Prevents ~1000+ PostGIS functions from cluttering `public` schema
- Makes debugging and schema exploration easier
- Follows PostgreSQL best practices

PostGIS functions remain fully accessible via `search_path` configuration. The `web_anon` and `authenticated` roles have their search_path set to `public, postgis`, allowing unqualified PostGIS function calls.

**When using PostGIS types or functions in SQL:**
- In application code via PostgREST: Functions work without schema qualification (due to search_path)
- In init scripts or migrations: Use schema-qualified references:
  - Type: `postgis.geography(Point, 4326)`
  - Function: `postgis.ST_AsText($1.location)`

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

### Managing Entity Configuration (Admin Only)

Admins can customize how entities appear in the application via the **Entities** page (`/entity-management`):

**Features**:
- **Display Names**: Override table names with user-friendly labels (e.g., "Issue" → "Issues")
- **Descriptions**: Add helpful descriptions that appear as tooltips on List, Create, and Edit pages
- **Drag-to-Reorder**: Change menu order by dragging entities
- **Auto-save**: Changes save automatically with visual feedback

**Access**:
1. Login as a user with the `admin` role
2. Open the left menu and click **Entities** under the Admin section
3. Drag entities to reorder them in the menu
4. Edit display names and descriptions inline
5. Changes automatically refresh the menu without page reload

**Database Schema**:
- Entity metadata stored in `metadata.entities` table
- Protected by RLS policies requiring admin role
- Updates via RPC functions: `upsert_entity_metadata()`, `update_entity_sort_order()`

**UI Components**:
- **EntityManagementService** (`src/app/services/entity-management.service.ts`): Handles entity metadata CRUD operations
- **EntityManagementPage** (`src/app/pages/entity-management/`): Admin UI with drag-drop powered by Angular CDK
- **Tooltips**: Description tooltips use DaisyUI's tooltip component with `help_outline` icon

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

### Angular 20 Reactive State with Signals

**IMPORTANT**: Angular 20 requires Signals for reactive component state to ensure proper change detection, especially with the new control flow syntax (`@if`, `@for`) and zoneless change detection.

**When to use Signals**:
- Any component property that changes during runtime and is displayed in the template
- Properties that control conditional rendering (`@if`, `@else`)
- Data fetched from APIs that updates the UI
- Form state, loading indicators, error messages

**Pattern**:
```typescript
import { Component, signal } from '@angular/core';

export class MyComponent {
  // ✅ Use Signal for reactive state
  data = signal<MyData | undefined>(undefined);
  loading = signal(true);
  error = signal<string | undefined>(undefined);

  loadData() {
    this.dataService.fetch().subscribe({
      next: (result) => {
        this.data.set(result);  // Update signal
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }
}
```

**Template syntax**:
```html
<!-- Access signal values with () -->
@if (loading()) {
  <span class="loading"></span>
}

<!-- Use 'as' syntax for type narrowing -->
@if (data(); as myData) {
  <p>{{ myData.name }}</p>
  <p>{{ myData.value }}</p>
}

@if (error(); as err) {
  <div class="alert alert-error">{{ err }}</div>
}
```

**Common mistake**:
```typescript
// ❌ Plain property - may not trigger change detection in Angular 20
public error?: ApiError;

// Template won't reliably update
@if (this.error) { ... }
```

**Reference implementations**:
- `DialogComponent` (src/app/components/dialog/dialog.component.ts) - Uses Signal for error state
- `PermissionsPage` (src/app/pages/permissions/permissions.page.ts) - Uses Signals throughout
- `EntityManagementPage` (src/app/pages/entity-management/entity-management.page.ts) - Signal-based reactive state

### Angular 20 Best Practices: OnPush + Async Pipe

**CRITICAL**: All components should use `OnPush` change detection with the `async` pipe for observables. Do NOT manually subscribe to observables in components with `OnPush` - this will cause change detection issues.

**Required pattern for all pages**:
```typescript
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-my-page',
  changeDetection: ChangeDetectionStrategy.OnPush,  // ✅ Required
  imports: [CommonModule],
  templateUrl: './my-page.component.html'
})
export class MyPageComponent {
  // ✅ Expose Observable with $ suffix
  data$: Observable<MyData> = this.dataService.getData();

  // ❌ WRONG - manual subscription with OnPush won't trigger change detection
  constructor() {
    this.dataService.getData().subscribe(data => {
      this.someProperty = data;  // Won't update template reliably
    });
  }
}
```

**Template pattern with async pipe**:
```html
<!-- ✅ Correct: Use async pipe to subscribe -->
@if (data$ | async; as data) {
  <div>{{ data.name }}</div>
  <div>{{ data.value }}</div>
} @else {
  <span class="loading loading-spinner"></span>
}
```

**Why this matters**:
- `OnPush` change detection only runs when:
  1. Input properties change
  2. Events fire from the template
  3. The `async` pipe receives new values
- Manual subscriptions don't trigger `OnPush` change detection
- The `async` pipe handles subscription/unsubscription automatically
- Loading states are handled by the `@else` block (shown while Observable hasn't emitted)

**Reference implementations**:
- `SchemaErdPage` (src/app/pages/schema-erd/schema-erd.page.ts) - Uses OnPush + async pipe
- `ListPage`, `DetailPage`, `CreatePage`, `EditPage` - Check these for async pipe usage

### Coordinating ViewChild with Async Data (effect() Pattern)

**Problem**: When a DOM element is conditionally rendered based on async data (e.g., `@if (data$ | async)`), the `viewChild()` signal won't have a value until AFTER the data loads and the element renders.

**Solution**: Use Angular's `effect()` to react when BOTH the data and the DOM element are available.

**Pattern**:
```typescript
import { Component, effect, viewChild, signal, ElementRef } from '@angular/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  // ...
})
export class MyComponent {
  // Observable for template
  data$: Observable<MyData> = this.dataService.getData();

  // Signal to store loaded data
  private dataLoaded = signal<MyData | null>(null);

  // ViewChild signal (undefined until element renders)
  containerElement = viewChild<ElementRef<HTMLDivElement>>('container');

  constructor() {
    // Store data when observable emits
    this.data$.subscribe(data => this.dataLoaded.set(data));

    // Effect runs when EITHER signal changes
    effect(() => {
      const data = this.dataLoaded();
      const container = this.containerElement()?.nativeElement;

      // Both available? Do the work!
      if (data && container) {
        this.processData(data, container);
      }
    });
  }
}
```

**Template**:
```html
@if (data$ | async; as data) {
  <div #container>
    <!-- Container appears AFTER data loads -->
  </div>
}
```

**Why this works**:
- `effect()` automatically tracks signal dependencies
- Runs when `dataLoaded` signal changes (when data arrives)
- Runs when `containerElement` signal changes (when DOM renders)
- Both conditions met = your code executes

**Reference implementation**:
- `SchemaErdPage` (src/app/pages/schema-erd/schema-erd.page.ts) - Uses effect() to coordinate Mermaid rendering with DOM availability

## Database Schema Visualization (ERD)

The application includes an Entity Relationship Diagram feature that automatically generates ERDs from the database schema metadata.

**Components**:
- **SchemaErdService** (`src/app/services/schema-erd.service.ts`) - Converts schema metadata to Mermaid erDiagram syntax
- **SchemaErdPage** (`src/app/pages/schema-erd/schema-erd.page.ts`) - Renders ERD using Mermaid.js library

**How it works**:
1. Fetches entities and properties from `SchemaService` (using `take(1)` to complete observables for `forkJoin`)
2. Generates Mermaid syntax for entities with their attributes (PK, FK, types)
3. Generates relationship lines based on foreign key metadata (`join_table`, `join_column`)
4. Renders diagram using Mermaid.js with automatic theme mapping

**Theme Mapping**:
The ERD automatically selects an appropriate Mermaid theme based on the active DaisyUI theme:
- `light` → Mermaid `default` (standard light theme)
- `dark` → Mermaid `dark` (dark mode)
- `corporate` → Mermaid `neutral` (professional B&W aesthetic)
- `nord` → Mermaid `dark` (dark theme)
- `emerald` → Mermaid `forest` (green color scheme)

**Relationship Detection**:
Currently supports **many-to-one** relationships only:
- Detects foreign keys via `join_table` and `join_column` in schema metadata
- Syntax: `FROM }o--|| TO` (many FROM records reference one TO record)
- Example: `Issue }o--|| IssueStatus : "status"` (many issues have one status)

**Not currently supported**:
- One-to-one relationships (would require unique constraint detection)
- Many-to-many relationships (would require junction table pattern detection)

**Accessing the ERD**:
- Menu → About → Database Schema
- Route: `/schema-erd`
- Available to all users (no authentication required)

## Git Commit Guidelines

- Use concise summary-style commit messages that describe the overall change
- Avoid bulleted lists of individual changes - summarize the purpose instead
- Keep commit messages clean and professional
- NEVER include promotional content or advertisements
- NEVER include attribution like "Generated with Claude Code" or "Co-Authored-By: Claude"
- Focus on the technical changes and their purpose
