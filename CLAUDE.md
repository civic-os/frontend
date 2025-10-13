# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Civic OS is a meta-application framework that automatically generates CRUD (Create, Read, Update, Delete) views for any PostgreSQL database schema. The Angular frontend dynamically creates list, detail, create, and edit pages based on database metadata stored in custom PostgreSQL views.

**Key Concept**: Instead of manually building UI for each table, Civic OS reads database schema metadata from `schema_entities` and `schema_properties` views to automatically generate forms, tables, and validation.

**License**: This project is licensed under the GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later). Copyright (C) 2023-2025 Civic OS, L3C. See the LICENSE file for full terms.

## Architecture

### Core Data Flow
1. **Database Schema** → PostgreSQL metadata tables (`metadata.entities`, `metadata.properties`)
2. **Metadata Views** → `schema_entities` and `schema_properties` views aggregate database structure
3. **SchemaService** → Fetches metadata and determines property types (text, number, foreign key, etc.)
4. **DataService** → Performs CRUD operations via PostgREST API
5. **Dynamic Pages** → List/Detail/Create/Edit pages render based on schema metadata
6. **Smart Components** → `DisplayPropertyComponent` and `EditPropertyComponent` adapt to property types

### Key Services

**SchemaService** (`src/app/services/schema.service.ts`) - Fetches and caches entity and property metadata, determines property types from PostgreSQL data types (e.g., `int4` with `join_column` → `ForeignKeyName`), filters properties for different contexts (list, detail, create, edit)

**DataService** (`src/app/services/data.service.ts`) - Abstracts PostgREST API calls, builds query strings with select fields, ordering, and filters

**AuthService** (`src/app/services/auth.service.ts`) - Integrates with Keycloak for authentication via `keycloak-angular` library

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

**Geography (GeoPoint) Type**: When adding a geography column, you must create a paired computed field function `<column_name>_text` that returns `ST_AsText()`. PostgREST exposes this as a virtual field. Data format: Insert/Update uses EWKT `"SRID=4326;POINT(lng lat)"`, Read receives WKT `"POINT(lng lat)"`.

**DateTime vs DateTimeLocal - Timezone Handling**:

These two timestamp types have fundamentally different timezone behaviors:

- **DateTime** (`timestamp without time zone`): Stores "wall clock" time with NO timezone context
  - Database stores exactly what user enters (e.g., "10:30 AM" → "10:30 AM")
  - No timezone conversion on load or submit
  - Use for: Scheduled events, business hours, appointment slots (where timezone doesn't matter)

- **DateTimeLocal** (`timestamptz`): Stores absolute point in time in UTC
  - User enters time in THEIR local timezone (e.g., "5:30 PM EST")
  - Frontend converts to UTC before sending to database (e.g., "10:30 PM UTC")
  - On load, converts UTC back to user's local timezone for display
  - Use for: Created/updated timestamps, events tied to specific moments in time

**CRITICAL**: The transformation logic in `EditPage.transformValueForControl()`, `EditPage.transformValuesForApi()`, and `CreatePage.transformValuesForApi()` handles these conversions. Modifying this code can cause data integrity issues. See extensive inline comments and tests for implementation details.

**Many-to-Many Relationships**: Automatically detected from junction tables with foreign keys. Junction tables MUST use composite primary keys (NOT surrogate IDs) to prevent duplicate key errors. The system detects M:M relationships via metadata analysis and renders them with `ManyToManyEditorComponent` on Detail pages only (not Create/Edit). Changes are saved immediately using direct REST operations (POST/DELETE). Junction table structure:
```sql
CREATE TABLE issue_tags (
  issue_id BIGINT NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (issue_id, tag_id)  -- Composite key, NOT surrogate id
);
-- REQUIRED: Index the foreign keys for performance
CREATE INDEX idx_issue_tags_issue_id ON issue_tags(issue_id);
CREATE INDEX idx_issue_tags_tag_id ON issue_tags(tag_id);
```
The UI displays in display mode by default (read-only badges) with an "Edit" button to enter edit mode (checkboxes with pending changes preview). Users need CREATE and DELETE permissions on the junction table to edit relationships. See `ManyToManyEditorComponent` and `docs/notes/MANY_TO_MANY_DESIGN.md` for implementation details.

**Full-Text Search**: Add `civic_os_text_search` tsvector column (generated, indexed) and configure `metadata.entities.search_fields` array. Frontend automatically displays search input on List pages. See example tables for implementation pattern.

## Development Commands

**Daily Development:**
```bash
npm start                          # Start dev server (http://localhost:4200)
npm run watch                      # Build in watch mode
```

**Testing:**
```bash
npm run test:headless              # Run once and exit (RECOMMENDED - use this!)
npm test -- --no-watch             # Run all tests without watch mode
npm test -- --no-watch --include='**/schema.service.spec.ts'  # Run specific file
```

**CRITICAL**: Always use `--no-watch` or `npm run test:headless` when running tests as Claude Code. Watch mode keeps the process running indefinitely, which blocks the tool and wastes resources. The `test:headless` script is specifically configured to run once and exit cleanly.

**KNOWN ISSUE**: FilterBarComponent cannot be unit tested due to Angular effects creating unmanaged subscriptions in `loadFilterOptions()`. The effect triggers on property changes and calls `dataService.getData().subscribe()` without cleanup, causing subscription leaks in tests. The component works correctly in production but causes test hangs when created/destroyed repeatedly. Fix requires refactoring to use `takeUntilDestroyed()` or converting to signal-based data loading.

See `docs/development/TESTING.md` for comprehensive testing guidelines, best practices, and troubleshooting.

**Building:**
```bash
npm run build                      # Production build
```

**Code Generation:**
```bash
ng generate component components/component-name
ng generate service services/service-name
ng generate component pages/page-name --type=page  # Use "page" suffix by convention
```

**Mock Data Generation:**
```bash
# Generate and insert mock data directly to database (RECOMMENDED)
set -a && source example/.env && set +a && npm run generate:mock

# Or generate SQL file (legacy, use only for reference)
set -a && source example/.env && set +a && npm run generate:mock -- --sql
```

The mock data generator is **validation-aware**: it fetches validation rules from `metadata.validations` and generates compliant data (respects min/max, minLength/maxLength, pattern constraints). Configure `scripts/mock-data-config.json` to control record counts and geography bounds. See `scripts/README.md` for details.

**Important**: Mock data should be generated AFTER database initialization (after `docker-compose up`), not during init scripts. This allows schema changes to flow smoothly without being blocked by stale static SQL files. The deprecated `example/init-scripts/05_mock_data.sql.deprecated` file is kept only as reference.

## Database Setup

Docker Compose runs PostgreSQL 17 with PostGIS 3.5 and PostgREST locally with Keycloak authentication. Init scripts in `postgres/` directory run in alphabetical order to create PostgREST roles, RBAC functions, Civic OS metadata schema, and dynamic views. See `example/README.md` for complete setup instructions.

**Important**: Init scripts only run on first database creation. To apply changes, either recreate the database (`docker-compose down -v && docker-compose up -d`) or apply changes manually (`docker exec postgres_db psql ...`).

**PostGIS**: Installed in dedicated `postgis` schema (not `public`) to keep the public schema clean. Functions accessible via `search_path`. In init scripts, use schema-qualified references: `postgis.geography(Point, 4326)` and `postgis.ST_AsText()`.

## PostgREST Integration

All API calls use PostgREST conventions:
- **Select fields**: `?select=id,name,created_at`
- **Embedded resources**: `?select=id,author:users(display_name)`
- **Filters**: `?id=eq.5`
- **Ordering**: `?order=created_at.desc`

The `SchemaService.propertyToSelectString()` method builds PostgREST-compatible select strings for foreign keys and user references.

## Authentication & RBAC

**Keycloak Authentication**: See `docs/AUTHENTICATION.md` for complete setup instructions including running your own Keycloak instance for RBAC testing.

**Quick Reference** (default shared instance):
- Keycloak URL: `https://auth.civic-os.org`
- Realm: `civic-os-dev`
- Client ID: `myclient`
- Configuration: `src/app/app.config.ts` (lines 36-39)

**RBAC System**: Permissions are stored in database (`metadata.roles`, `metadata.permissions`, `metadata.permission_roles`). PostgreSQL functions (`get_user_roles()`, `has_permission()`, `is_admin()`) extract roles from JWT claims and enforce permissions via Row Level Security policies.

**Default Roles**: `anonymous` (unauthenticated), `user` (authenticated), `editor` (create/edit), `admin` (full access + permissions UI)

**Admin Features** (require `admin` role):
- **Permissions Page** (`/permissions`) - Manage role-based table permissions
- **Entities Page** (`/entity-management`) - Customize entity display names, descriptions, menu order
- **Properties Page** (`/property-management`) - Configure column labels, descriptions, sorting, width, visibility

**Troubleshooting RBAC**: See `docs/TROUBLESHOOTING.md` for debugging JWT roles and permissions issues.

## Common Patterns

### Adding a New Entity to the UI
1. Create table in PostgreSQL `public` schema
2. Grant permissions (INSERT, SELECT, UPDATE, DELETE) to `authenticated` role
3. **IMPORTANT: Create indexes on all foreign key columns** (PostgreSQL does NOT auto-index FKs)
   ```sql
   -- Example: For a table with foreign keys
   CREATE TABLE issues (
     id SERIAL PRIMARY KEY,
     status_id INT REFERENCES statuses(id),
     user_id UUID REFERENCES civic_os_users(id)
   );

   -- REQUIRED: Add indexes for FK columns (needed for inverse relationships and performance)
   CREATE INDEX idx_issues_status_id ON issues(status_id);
   CREATE INDEX idx_issues_user_id ON issues(user_id);
   ```
4. Navigate to `/view/your_table_name` - UI auto-generates
5. (Optional) Add entries to `metadata.entities` and `metadata.properties` for custom display names, ordering, etc.

**Why FK indexes matter:** The inverse relationships feature (showing related records on Detail pages) requires indexes on foreign key columns to avoid full table scans. Without these indexes, queries like `SELECT * FROM issues WHERE status_id = 1` will be slow on large tables.

### Custom Property Display
Override `metadata.properties.display_name` to change labels. Set `sort_order` to control field ordering. Set `column_width` (1-2) for form field width in Create/Edit forms. Set `sortable` to enable/disable column sorting on List pages.

### Handling New Property Types
1. Add new type to `EntityPropertyType` enum
2. Update `SchemaService.getPropertyType()` to detect the type
3. Add rendering logic to `DisplayPropertyComponent`
4. Add input control to `EditPropertyComponent`

### Form Validation

Civic OS provides a flexible validation system with **dual enforcement**: frontend validation for UX and backend CHECK constraints for security.

**Supported Validation Types**: `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`

**Adding Validation to a Property:**

```sql
-- 1. Add CHECK constraint (backend enforcement)
ALTER TABLE products
  ADD CONSTRAINT price_positive CHECK (price > 0);

-- 2. Add validation metadata (frontend UX)
INSERT INTO metadata.validations (table_name, column_name, validation_type, validation_value, error_message, sort_order)
VALUES ('products', 'price', 'min', '0.01', 'Price must be greater than zero', 1);

-- 3. Map CHECK constraint to friendly error message (for when frontend is bypassed)
INSERT INTO metadata.constraint_messages (constraint_name, table_name, column_name, error_message)
VALUES ('price_positive', 'products', 'price', 'Price must be greater than zero');
```

**How It Works:**
- `metadata.validations` → Frontend validators (Angular `Validators.min()`, `.max()`, `.pattern()`, etc.)
- `schema_properties` view → Aggregates validation rules as JSONB array
- `SchemaService.getFormValidatorsForProperty()` → Maps rules to Angular validators
- `EditPropertyComponent` → Displays custom error messages in real-time
- `ErrorService.parseToHuman()` → Translates CHECK constraint errors (code '23514') to friendly messages

**Example Validation Patterns:**
```sql
-- Numeric range (1-5 scale)
INSERT INTO metadata.validations VALUES
  ('issues', 'severity', 'min', '1', 'Severity must be between 1 and 5', 1),
  ('issues', 'severity', 'max', '5', 'Severity must be between 1 and 5', 2);

-- String length
INSERT INTO metadata.validations VALUES
  ('issues', 'description', 'minLength', '10', 'Description must be at least 10 characters', 1);

-- Pattern validation (phone number)
INSERT INTO metadata.validations VALUES
  ('users', 'phone', 'pattern', '^\d{10}$', 'Phone must be 10 digits (no dashes)', 1);
```

**See Also:** `example/init-scripts/02_validation_examples.sql` for complete examples in the Pot Hole domain.

**Future Enhancement:** Async/RPC validators for database lookups (uniqueness checks, cross-field validation). See `docs/development/ADVANCED_VALIDATION.md`.

## Angular 20 Critical Patterns

### Signals for Reactive State

**IMPORTANT**: Use Signals for reactive component state to ensure proper change detection with zoneless architecture and new control flow syntax (`@if`, `@for`).

```typescript
import { Component, signal } from '@angular/core';

export class MyComponent {
  data = signal<MyData | undefined>(undefined);
  loading = signal(true);
  error = signal<string | undefined>(undefined);

  loadData() {
    this.dataService.fetch().subscribe({
      next: (result) => {
        this.data.set(result);
        this.loading.set(false);
      },
      error: (err) => this.error.set(err.message)
    });
  }
}
```

**Template**: Access signal values with `()` syntax: `@if (loading()) { <span class="loading"></span> }`

### OnPush + Async Pipe Pattern

**CRITICAL**: All components should use `OnPush` change detection with the `async` pipe. Do NOT manually subscribe to observables in components with `OnPush` - this causes change detection issues.

```typescript
@Component({
  selector: 'app-my-page',
  changeDetection: ChangeDetectionStrategy.OnPush,  // Required
  // ...
})
export class MyPageComponent {
  // Expose Observable with $ suffix
  data$: Observable<MyData> = this.dataService.getData();
}
```

**Template**: Use async pipe: `@if (data$ | async; as data) { <div>{{ data.name }}</div> }`

**Why**: OnPush change detection only runs when: (1) Input properties change, (2) Events fire from template, (3) The `async` pipe receives new values. Manual subscriptions don't trigger OnPush.

**Reference implementations**:
- `PermissionsPage`, `EntityManagementPage` - Signal-based state
- `SchemaErdPage`, `ListPage`, `DetailPage` - OnPush + async pipe

## Styling

- **Tailwind CSS** for utility classes
- **DaisyUI** component library (themes: light, dark, corporate, nord, emerald)
- Global styles in `src/styles.css`

## TypeScript Configuration

- Strict mode enabled
- `experimentalDecorators: true` for Angular decorators
- Target: ES2022
- Module resolution: bundler

## Documentation Conventions

When creating new documentation files, follow this structure:

**Root Level (reserved):**
- `README.md` - Project overview and quick start guide
- `CLAUDE.md` - AI assistant instructions (this file)
- `LICENSE` - License file

**Documentation Structure:**
- `docs/` - User-facing documentation (setup guides, troubleshooting)
  - `AUTHENTICATION.md` - Authentication and Keycloak setup
  - `TROUBLESHOOTING.md` - Common issues and solutions
  - `ROADMAP.md` - Feature roadmap and planning
- `docs/development/` - Developer-specific guides
  - `ANGULAR.md` - Angular coding standards and patterns
  - `TESTING.md` - Testing guidelines and best practices
- `docs/notes/` - Historical notes, bug documentation, research
  - `DRAG_DROP_BUG_FIX.md` - Bug fix documentation example
  - `FILE_STORAGE_OPTIONS.md` - Research document example

**When to create new documentation:**
- User guides → `docs/`
- Developer guides → `docs/development/`
- Bug postmortems, research notes → `docs/notes/`
- **Never** create markdown files in the root directory (except README.md and CLAUDE.md)

## Git Commit Guidelines

- Use concise summary-style commit messages that describe the overall change
- Avoid bulleted lists of individual changes - summarize the purpose instead
- Keep commit messages clean and professional
- NEVER include promotional content or advertisements
- NEVER include attribution like "Generated with Claude Code" or "Co-Authored-By: Claude"
- Focus on the technical changes and their purpose
