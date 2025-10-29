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

**SchemaService Architecture (Hybrid Signal + Observable Pattern):**

The SchemaService uses a hybrid approach combining Angular signals for reactive state with RxJS observables for async HTTP operations. This pattern prevents duplicate HTTP requests while maintaining proper change detection.

**Key Design Patterns:**

1. **Signal-to-Observable Conversion** - Uses `toObservable()` to create observable streams from signals:
   ```typescript
   // Created once in injection context (class field initializer)
   private tables$ = toObservable(this.tables).pipe(
     filter(tables => tables !== undefined),
     map(tables => tables!)
   );
   ```
   **Why**: `toObservable()` must be called in injection context, so it's created as a class field. This single observable is shared across all subscribers.

2. **In-Flight Request Tracking** - Boolean flags prevent concurrent duplicate HTTP requests:
   ```typescript
   private loadingEntities = false;
   private loadingProperties = false;

   public getEntities(): Observable<SchemaEntityTable[]> {
     // Only trigger fetch if not already loaded AND not currently loading
     if (!this.tables() && !this.loadingEntities) {
       this.loadingEntities = true;
       this.getSchema().subscribe();
     }
     return this.tables$;
   }
   ```
   **Why**: Without this pattern, multiple components calling `getEntities()` simultaneously would trigger multiple HTTP requests before the first completes. The flag is reset in `finalize()` when HTTP completes.

3. **HTTP Observable Caching with shareReplay()** - Caches HTTP observables to prevent repeat requests:
   ```typescript
   private getSchema() {
     if (!this.schemaCache$) {
       this.schemaCache$ = this.http.get<SchemaEntityTable[]>(url)
         .pipe(
           tap(tables => this.tables.set(tables)),
           finalize(() => this.loadingEntities = false),
           shareReplay({ bufferSize: 1, refCount: false })
         );
     }
     return this.schemaCache$;
   }
   ```
   **Why**: `shareReplay({ bufferSize: 1, refCount: false })` ensures the HTTP call executes once and all subscribers receive the cached result. `refCount: false` keeps the cache alive even when all subscribers unsubscribe.

4. **Selective Cache Invalidation** - Separate caches for entities and properties enable targeted refresh:
   ```typescript
   public refreshEntitiesCache() {
     this.schemaCache$ = null;
     this.loadingEntities = false;
     this.tables.set(undefined);
   }
   ```
   **Why**: When RBAC permissions change, only affected caches need refresh. The `schemaVersionGuard` determines which caches to invalidate based on version checks.

**Authentication Integration:**

The AuthService does NOT call `refreshCache()` on Keycloak's `Ready` event. Schema cache is loaded on-demand when components first request it. This prevents duplicate HTTP requests during app initialization.

**When schema cache IS refreshed:**
- User logout (`AuthService` line 67) - Clear all cached data when user changes
- Schema version change (`schemaVersionGuard`) - Selective refresh when database metadata updates
- Manual refresh via `refreshCache()` method

**When schema cache is NOT refreshed:**
- Keycloak SSO check complete (Ready event) - Schema loads on-demand instead
- User login - Schema loads naturally when user navigates to first page

**Performance Impact:**
- Without in-flight tracking: ~12 duplicate requests per page load (~444 KB wasted)
- With in-flight tracking: 1-2 requests per page load (~74 KB total, 83% reduction)

**DataService** (`src/app/services/data.service.ts`) - Abstracts PostgREST API calls, builds query strings with select fields, ordering, and filters

**AuthService** (`src/app/services/auth.service.ts`) - Integrates with Keycloak for authentication via `keycloak-angular` library

### Property Type System

The `EntityPropertyType` enum maps PostgreSQL types to UI components:
- `ForeignKeyName`: Integer/UUID with `join_column` → Dropdown with related entity's display_name
- `User`: UUID with `join_table = 'civic_os_users'` → User display component with unified view access
  - **Unified View Architecture**: The `civic_os_users` view in `public` schema combines data from `metadata.civic_os_users` (public profile) and `metadata.civic_os_users_private` (private contact info)
  - **API Response**: `{id, display_name, full_name, phone, email}` where private fields (`full_name`, `phone`, `email`) are NULL unless user views own record or has `civic_os_users_private:read` permission
  - **Storage**: Actual tables reside in `metadata` schema for namespace organization; view provides backward-compatible API surface
  - **Profile Management**: User profile data (name, email, phone) is managed in Keycloak (single source of truth) and synced to Civic OS on login via `refresh_current_user()` RPC. The "Account Settings" menu item links to Keycloak's account console with referrer params for easy return. Phone number requires custom user attribute and JWT mapper configuration (see `docs/AUTHENTICATION.md` Step 5).
- `DateTime`, `DateTimeLocal`, `Date`: Timestamp types → Date/time inputs
- `Boolean`: `bool` → Checkbox
- `Money`: `money` → Currency input (ngx-currency)
- `IntegerNumber`: `int4`/`int8` → Number input
- `TextShort`: `varchar` → Text input
- `TextLong`: `text` → Textarea
- `GeoPoint`: `geography(Point, 4326)` → Interactive map (Leaflet) with location picker
- `Color`: `hex_color` → Color chip display with native HTML5 color picker
- `Email`: `email_address` → Clickable mailto: link, HTML5 email input
- `Telephone`: `phone_number` → Clickable tel: link with formatted display, masked input (XXX) XXX-XXXX

**Color Type**: Use the `hex_color` domain for RGB color values. The domain enforces `#RRGGBB` format validation at the database level. UI displays colors as badges with colored swatches, and provides both a visual color picker and text input for editing. Example:
```sql
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(50) NOT NULL,
  color hex_color NOT NULL DEFAULT '#3B82F6'
);
```

**Email Type**: Use the `email_address` domain for email addresses. The domain enforces simplified RFC 5322 validation at the database level. UI displays emails as clickable mailto: links and provides HTML5 email input with mobile keyboard optimization. Pattern: `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`

**Telephone Type**: Use the `phone_number` domain for US phone numbers. The domain enforces 10-digit format (no dashes or formatting) at the database level. UI displays formatted as (XXX) XXX-XXXX and renders as clickable tel: links. Input uses masked entry with automatic formatting as user types. Storage format: 10 digits (e.g., "5551234567").

Example:
```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  email email_address NOT NULL,
  phone phone_number,
  alternate_email email_address
);
```

**File Storage Types** (`FileImage`, `FilePDF`, `File`): UUID foreign keys to `metadata.files` table for S3-based file storage with automatic thumbnail generation. Civic OS provides complete file upload workflow via PostgreSQL functions and background workers. Files are stored in S3-compatible storage (MinIO for dev, AWS S3 for production) with presigned URL workflow that maintains PostgREST-only communication from Angular.

**Architecture**:
- **Database**: `metadata.files` table stores file metadata and S3 keys, `file_upload_requests` table manages presigned URL workflow
- **S3 Signer Service**: Node.js service listens to PostgreSQL NOTIFY events and generates presigned upload URLs
- **Thumbnail Worker**: Background service processes uploaded images (3 sizes: 150px, 400px, 800px) and PDFs (first page at 400px) using Sharp and Poppler
- **S3 Key Structure**: `{entity_type}/{entity_id}/{file_id}/original.{ext}` and `/thumb-{size}.jpg` for thumbnails
- **UUIDv7**: Time-ordered UUIDs improve B-tree index performance

**Property Type Detection**:
```typescript
// SchemaService.getPropertyType() detects file types from validation metadata
if (column.udt_name === 'uuid' && column.join_table === 'files') {
  const fileTypeValidation = column.validation_rules?.find(v => v.type === 'fileType');
  if (fileTypeValidation?.value?.startsWith('image/')) {
    return EntityPropertyType.FileImage;  // Thumbnails + lightbox viewer
  } else if (fileTypeValidation?.value === 'application/pdf') {
    return EntityPropertyType.FilePDF;    // First-page thumbnail + iframe viewer
  }
  return EntityPropertyType.File;         // Generic file with download link
}
```

**UI Behavior**:
- **Display**: `DisplayPropertyComponent` shows thumbnails (with loading/error states), opens lightbox for images, iframe viewer for PDFs
- **Edit**: `EditPropertyComponent` provides file input with drag-drop, validates type/size, uploads immediately on selection, shows progress
- **Create**: File properties are filtered out of Create forms (files require existing entity ID)
- **Validation**: Frontend validates before upload; backend enforces via validation metadata

**Adding File Properties**:
```sql
-- 1. Add UUID column with FK to files table
ALTER TABLE issues ADD COLUMN photo UUID REFERENCES metadata.files(id);

-- 2. Create index (required for performance)
CREATE INDEX idx_issues_photo ON issues(photo);

-- 3. Add validation metadata
INSERT INTO metadata.validations (table_name, column_name, validation_type, validation_value, error_message, sort_order)
VALUES
  ('issues', 'photo', 'fileType', 'image/*', 'Only image files are allowed', 1),
  ('issues', 'photo', 'maxFileSize', '5242880', 'File size must not exceed 5 MB', 2);

-- 4. (Optional) Add custom display name
INSERT INTO metadata.properties (table_name, column_name, display_name, description, sort_order)
VALUES ('issues', 'photo', 'Photo', 'Upload a photo of the issue', 50);
```

**Validation Types**:
- `fileType`: MIME type constraint (e.g., `image/*`, `image/jpeg`, `application/pdf`)
- `maxFileSize`: Maximum size in bytes (e.g., `5242880` = 5 MB, `10485760` = 10 MB)

**S3 Configuration**: Currently hardcoded to `http://localhost:9000/civic-os-files/` for MinIO development. Production should use environment configuration with CloudFront or S3 bucket URLs. See `FileUploadService.getS3Url()`, `DisplayPropertyComponent.getS3Url()`, and `PdfViewerComponent.getS3Url()` for TODO comments.

**Services**:
- `FileUploadService` (`src/app/services/file-upload.service.ts`): Handles complete upload workflow (request presigned URL → upload to S3 → create file record → poll for thumbnails)
- **Docker Compose**: `example/docker-compose.yml` includes MinIO (ports 9000/9001), s3-signer service, and thumbnail-worker service
- **Migration**: `postgres/migrations/deploy/v0-5-0-add-file-storage.sql` adds core file storage infrastructure

**Example Usage**: See `example/init-scripts/07_add_file_fields.sql` for complete example with `Issue.photo` (image) and `WorkPackage.report_pdf` (PDF).

**Geography (GeoPoint) Type**: When adding a geography column, you must create a paired computed field function `<column_name>_text` that returns `ST_AsText()`. PostgREST exposes this as a virtual field. Data format: Insert/Update uses EWKT `"SRID=4326;POINT(lng lat)"`, Read receives WKT `"POINT(lng lat)"`.

**Map Dark Mode**: Maps automatically switch between light and dark tile layers based on the current DaisyUI theme. The `ThemeService` (`src/app/services/theme.service.ts`) **dynamically calculates theme luminance** by reading the `--b1` CSS variable (base background color) and applying the YIQ brightness formula. This works with **any DaisyUI theme** (including custom themes) without hardcoded theme names. Light themes use OpenStreetMap tiles; dark themes use ESRI World Dark Gray tiles. `GeoPointMapComponent` subscribes to theme changes via MutationObserver on the `data-theme` attribute and swaps tile layers dynamically without page reload.

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
# For the Pot Hole example project:
set -a && source example/.env && set +a && npm run generate:mock:example
set -a && source example/.env && set +a && npm run generate:mock:example:sql  # SQL file only

# For the Broader Impacts (UMFlint) project:
set -a && source broader-impacts/.env && set +a && npm run generate:mock:bi
set -a && source broader-impacts/.env && set +a && npm run generate:mock:bi:sql  # SQL file only
```

The mock data generator is **validation-aware**: it fetches validation rules from `metadata.validations` and generates compliant data (respects min/max, minLength/maxLength, pattern constraints). Configure `scripts/mock-data-config.json` to control record counts and geography bounds. See `scripts/README.md` for details.

**Important**: Mock data should be generated AFTER database initialization (after `docker-compose up`), not during init scripts. This allows schema changes to flow smoothly without being blocked by stale static SQL files. The deprecated `example/init-scripts/05_mock_data.sql.deprecated` file is kept only as reference.

## Database Setup

Docker Compose runs PostgreSQL 17 with PostGIS 3.5 and PostgREST locally with Keycloak authentication. The development environment uses **Sqitch migrations** (same as production) to set up the core Civic OS schema, ensuring dev/prod parity.

**Migration Flow** (automatic on first `docker-compose up`):
1. Postgres container builds custom image with Sqitch installed (`docker/dev-postgres/Dockerfile`)
2. Init script creates authenticator role (`example/init-scripts/00_create_authenticator.sh`)
3. Init script runs Sqitch migrations to deploy core schema (`postgres/migrations/`)
4. Example-specific scripts run (pothole tables, permissions, etc.)

**Important**: Schema changes should be made via migrations (see Database Migrations section below). To apply new migrations, recreate the database (`docker-compose down -v && docker-compose up -d`) or run migrations manually via the migrations container.

**PostGIS**: Installed in dedicated `postgis` schema (not `public`) to keep the public schema clean. Functions accessible via `search_path`. Use schema-qualified references: `postgis.geography(Point, 4326)` and `postgis.ST_AsText()`.

## Database Migrations

Civic OS uses **Sqitch** for versioned database schema migrations in **both development and production**. This ensures dev/prod parity and allows upgrading databases safely as new versions are released.

**Key Concepts:**
- **Core Objects Only**: Migrations manage `metadata.*` schema and core public objects (RPCs, views, domains). User application tables (`public.issues`, `public.tags`, etc.) are not managed by core migrations.
- **Version-Based Naming**: Migrations use `vX-Y-Z-note` format (e.g., `v0-4-0-add_tags_table`) to tie schema changes to releases.
- **Rollback Support**: Every migration has deploy/revert/verify scripts for safe upgrades and rollbacks.
- **Containerized**: Migration container (`ghcr.io/civic-os/migrations`) is versioned alongside frontend/postgrest for guaranteed compatibility.

**Quick Commands:**

```bash
# Generate new migration
./scripts/generate-migration.sh add_feature "Add feature X"

# Test locally
sqitch deploy dev --verify
sqitch revert dev --to @HEAD^  # Rollback
sqitch deploy dev --verify      # Re-deploy

# Deploy to production (using versioned container)
./scripts/migrate-production.sh v0.4.0 $DATABASE_URL
```

**Important Notes:**
- Migrations are **automatically tested** in CI/CD on every push
- Migration container **version must match** frontend/postgrest versions
- Generated migrations require **manual enhancement** (add metadata insertions, grants, RLS policies)
- See `postgres/migrations/README.md` for comprehensive documentation

**When to Create Migrations:**
- Adding/modifying `metadata.*` tables
- Adding/updating public RPCs or views
- Adding custom domains
- Schema changes that affect UI generation

## Production Deployment & Containerization

Civic OS provides production-ready Docker containers with runtime configuration via environment variables, following the 12-factor app methodology.

### Container Images

Three container images are automatically built and published to GitHub Container Registry on every push to `main`:

1. **Frontend Container** (`ghcr.io/civic-os/frontend`)
   - Multi-stage build: Angular build + nginx alpine
   - Runtime configuration via environment variables
   - Security headers, gzip compression, SPA routing
   - Multi-architecture support (amd64, arm64)

2. **PostgREST Container** (`ghcr.io/civic-os/postgrest`)
   - Based on official PostgREST image
   - Automatic JWKS fetching from Keycloak on startup
   - Multi-architecture support (amd64, arm64)

3. **Migrations Container** (`ghcr.io/civic-os/migrations`)
   - Sqitch-based database migrations
   - Runs as init container before PostgREST
   - Version-locked with frontend/postgrest for schema compatibility
   - Multi-architecture support (amd64, arm64)

### Version Tagging

Containers are automatically tagged with:
- `latest` - Most recent build
- `v0.3.0` - Semantic version from `package.json`
- `0.3.0` - Version without 'v' prefix
- `sha-abc1234` - Git commit SHA (for precise rollback)

To release a new version:
```bash
npm version patch   # 0.3.0 → 0.3.1
npm version minor   # 0.3.0 → 0.4.0
npm version major   # 0.3.0 → 1.0.0
git push
# GitHub Actions automatically builds and publishes new version
```

### Runtime Configuration

**Frontend Environment Variables:**
- `POSTGREST_URL` - PostgREST API endpoint (e.g., `http://localhost:3000/`)
- `KEYCLOAK_URL` - Keycloak server URL
- `KEYCLOAK_REALM` - Keycloak realm name
- `KEYCLOAK_CLIENT_ID` - Keycloak client ID
- `MAP_TILE_URL`, `MAP_ATTRIBUTION` - Map configuration
- `MAP_DEFAULT_LAT`, `MAP_DEFAULT_LNG`, `MAP_DEFAULT_ZOOM` - Map defaults

**PostgREST Environment Variables:**
- `PGRST_DB_URI` - PostgreSQL connection string
- `KEYCLOAK_URL` - Keycloak server URL (for JWKS fetching)
- `KEYCLOAK_REALM` - Keycloak realm name
- `PGRST_DB_SCHEMA` - Exposed schemas (default: `public,metadata`)
- `PGRST_DB_ANON_ROLE` - Anonymous role (default: `web_anon`)
- `PGRST_DB_PRE_REQUEST` - Pre-request function (default: `public.check_jwt`)

### Runtime Configuration Architecture

The frontend uses **semantic helper functions** (`src/app/config/runtime.ts`) to provide runtime configuration:

**How It Works:**

1. **Docker entrypoint** (`docker/frontend/docker-entrypoint.sh`) injects config inline into `index.html` as a `<script>` tag
2. **Script sets `window.civicOsConfig`** before Angular bootstrap (guaranteed to exist when app loads)
3. **Helper functions** read from `window.civicOsConfig` (production) or `environment.ts` (development):
   - `getPostgrestUrl()` - Returns PostgREST API URL
   - `getKeycloakConfig()` - Returns Keycloak authentication config object
   - `getMapConfig()` - Returns Leaflet map configuration
   - `getS3Config()` - Returns S3 storage endpoint and bucket configuration

**Usage Example:**

```typescript
import { getPostgrestUrl, getKeycloakConfig } from '../config/runtime';

// In services
export class DataService {
  private get(url: string) {
    return this.http.get(getPostgrestUrl() + url);
  }
}

// In app configuration
export const appConfig = {
  providers: [
    provideKeycloak({ config: getKeycloakConfig() })
  ]
};
```

**CRITICAL RULE: Always use helper functions, NEVER import `environment.postgrestUrl` directly.**

Direct imports get baked into the compiled bundle at build time and cannot be changed at runtime. This was the root cause of configuration bugs where services used `environment.postgrestUrl` instead of runtime helpers.

**Development vs Production:**
- Development: Helper functions fall back to `src/environments/environment.ts`
- Production: Helpers read `window.civicOsConfig` (injected inline by Docker entrypoint)

**Files to Update When Adding New Config:**
1. `docker/frontend/docker-entrypoint.sh` - Add to inline script template
2. `src/app/config/runtime.ts` - Add helper function or update existing getter
3. `src/environments/environment.ts` - Add development fallback value
4. `.env.example` - Document new environment variable

### Quick Deployment

**Using Docker Compose:**
```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

**Using Pre-Built Images:**
```bash
docker pull ghcr.io/civic-os/frontend:v0.3.0
docker pull ghcr.io/civic-os/postgrest:v0.3.0
```

**Building Locally:**
```bash
docker build -t civic-os-frontend:local -f docker/frontend/Dockerfile .
docker build -t civic-os-postgrest:local -f docker/postgrest/Dockerfile .
```

### GitHub Actions CI/CD

The `.github/workflows/build-containers.yml` workflow automatically:
1. Extracts version from `package.json`
2. Builds both containers for amd64 and arm64
3. Publishes to GitHub Container Registry with semantic version tags
4. Caches layers for faster subsequent builds

**Workflow triggers:**
- Push to `main` branch
- Manual workflow dispatch

### Additional Resources

- **docker/README.md** - Comprehensive Docker documentation
- **docker-compose.prod.yml** - Production deployment example
- **docs/deployment/PRODUCTION.md** - Complete production deployment guide

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

### Visual Diagramming with JointJS

**Reference Implementation**: Schema Editor POC (`/schema-editor-poc`)

The Schema Editor POC demonstrates best practices for integrating JointJS (MIT-licensed diagramming library) into Angular applications for visual schema representation and editing. This implementation serves as a reference for building visual diagramming features.

**Key Patterns Demonstrated**:

1. **JointJS Integration** (`schema-editor-poc.page.ts:298-334`)
   - Initialize graph and paper in `ngAfterViewInit()`
   - Store graph/paper references as component properties
   - Clean up in `ngOnDestroy()` to prevent memory leaks
   ```typescript
   this.graph = new dia.Graph({}, { cellNamespace: shapes });
   this.paper = new dia.Paper({
     el: this.canvasContainer.nativeElement,
     model: this.graph,
     interactive: { linkMove: false },
     cellViewNamespace: shapes
   });
   ```

2. **Geometric Port Ordering** (`schema-editor-poc.page.ts:400-439, 1051-1257`)
   - **Problem**: Type-based port assignment (FK→left/right, M:M→top/bottom) caused crossovers
   - **Solution**: Angle-based geometric algorithm that assigns ports based on spatial relationships
   - **Algorithm**: Calculate angle between entity centers using `Math.atan2()`, map to sides (top/right/bottom/left), sort by angle within each side
   - **Screen Coordinates**: Account for Y-axis inversion (positive Y = downward in screen coords)
   - **Benefits**: Shorter paths, fewer crossovers, more intuitive layout
   - **Testing**: 31 comprehensive unit tests validate geometry functions (`schema-editor-poc.page.spec.ts`)

3. **Auto-Layout Integration** (`schema-editor-poc.page.ts:1039-1222`)
   - Use Dagre hierarchical layout algorithm for automatic positioning
   - Recalculate geometric ports after layout completes
   - Metro router for smooth, natural curved paths

4. **Theme Integration** (`schema-editor-poc.page.ts:270-296`)
   - Use DaisyUI CSS variables (`var(--base-100)`, `var(--primary)`, etc.) for theme-aware styling
   - Automatically adapts to light/dark theme changes
   - Pattern matches GeoPointMapComponent theme handling

5. **Event Handling** (`schema-editor-poc.page.ts:659-702`)
   - Click entities to show inspector panel
   - Inspector panel displays entity metadata, properties, relationships, and validations
   - Navigation between related entities

**When to Use This Pattern**:
- Building visual editors (workflow designers, state machines, data flows)
- Creating interactive diagrams (network topology, org charts)
- Schema visualization and manipulation
- Any feature requiring draggable, connectable visual elements

**Documentation**:
- **Design**: `docs/notes/SCHEMA_EDITOR_DESIGN.md` - Complete implementation plan (Phase 1-4)
- **Algorithm**: `docs/notes/GEOMETRIC_PORT_ORDERING.md` - Detailed geometric port ordering explanation
- **Code**: `src/app/pages/schema-editor-poc/schema-editor-poc.page.ts`
- **Tests**: `src/app/pages/schema-editor-poc/schema-editor-poc.page.spec.ts`

**JointJS Resources**:
- MIT License: Compatible with AGPL-3.0-or-later
- Docs: https://resources.jointjs.com/docs/jointjs
- Demos: https://www.jointjs.com/demos/er-diagrams (ER diagram example)

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
