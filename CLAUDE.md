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

### Required PostgreSQL Scripts (run in order)
1. `postgres/0_postgrest.sql` - PostgREST configuration
2. `postgres/1_metadata.schema.sql` - Creates `metadata.entities` and `metadata.properties` tables
3. `postgres/2_schema_relations.function.sql` - Function to detect foreign key relationships
4. `postgres/3_schema_entities.view.sql` - View that lists entities with permissions
5. `postgres/4_schema_properties.view.sql` - View that lists properties with metadata
6. `postgres/5_permissions_roles.table.sql` - Roles and permissions schema
7. `postgres/6_rename_schema.sql` - Schema migrations
8. `postgres/7_add_users_table_and_auth_flow.sql` - User authentication tables

### Local Development with Supabase
```bash
# Navigate to example folder
cd example

# Start Supabase local instance
supabase start

# Run SQL scripts on local database
# (Scripts from postgres/ folder should be executed via Supabase dashboard or psql)
```

### Environment Configuration
- **Development**: `src/environments/environment.development.ts` - Points to `http://localhost:54321/rest/v1/` (Supabase local PostgREST)
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
- Bearer token automatically included for requests to `localhost:54321` via `includeBearerTokenInterceptor`

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
