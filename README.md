# Civic OS

A meta-application framework that automatically generates CRUD (Create, Read, Update, Delete) views for any PostgreSQL database schema. Instead of manually building UI for each table, Civic OS dynamically creates forms, tables, and validation based on database metadata.

**Vision**: For more background on the Civic OS project, see [Civic OS Vision](https://github.com/civic-os/vision).

## Key Features

- **Auto-Generated CRUD Views** - List, detail, create, and edit pages generated automatically from database schema
- **Rich Property Types** - Support for text, numbers, dates, money, booleans, foreign keys, users, and geography points with interactive maps
- **Role-Based Access Control** - Flexible permission system with database-driven roles and table-level CRUD permissions
- **Dynamic Schema Introspection** - Real-time ERD generation showing database relationships and structure
- **Metadata-Driven UI** - Customize display names, descriptions, field ordering, and validation rules without code changes
- **Modern Stack** - Angular 20 with Signals, Tailwind CSS, DaisyUI, and reactive patterns

## Technology Stack

- **Frontend**: Angular 20 (with Signals and standalone components)
- **Backend**: PostgREST API (auto-generated REST API from PostgreSQL)
- **Database**: PostgreSQL 17 with PostGIS 3.5
- **Authentication**: Keycloak (OAuth2/OIDC)
- **Styling**: Tailwind CSS + DaisyUI (with theme support)
- **Maps**: Leaflet.js for GeoPoint fields
- **Diagrams**: Mermaid.js for ERD visualization

## Prerequisites

- **Node.js** 20+ and npm
- **Docker** and Docker Compose (for local development)
- **Git**

## Quick Start

Get Civic OS running locally in 4 steps:

```bash
# 1. Clone the repository
git clone https://github.com/civic-os/civic-os.git
cd civic-os

# 2. Install dependencies
npm install

# 3. Set up authentication (choose one):
#    A) Use shared Keycloak (basic testing, can't manage roles)
#    B) Run your own Keycloak (see AUTHENTICATION.md for RBAC testing)
cd example
cp .env.example .env
./fetch-keycloak-jwk.sh  # Fetch Keycloak public key
docker-compose up -d
cd ..

# 4. Start the Angular development server
npm start
```

Open http://localhost:4200 in your browser. The example includes a Pot Hole Observation System with sample data.

**Authentication Note**: The default setup uses a shared Keycloak instance. To test RBAC features (roles, permissions, admin access), see [AUTHENTICATION.md](./AUTHENTICATION.md) for instructions on running your own Keycloak instance.

## Development Commands

```bash
# Development
npm start              # Start dev server (http://localhost:4200)
npm run watch          # Build in watch mode

# Testing
npm test               # Run unit tests (watch mode)
npm test -- --no-watch --browsers=ChromeHeadless  # Run once and exit

# Building
npm run build          # Production build

# Mock Data Generation
set -a && source example/.env && set +a && npm run generate:mock  # Generate SQL
set -a && source example/.env && set +a && npm run generate:seed  # Insert into DB

# Code Generation
ng generate component components/component-name
ng generate service services/service-name
```

## Architecture Overview

Civic OS uses a metadata-driven architecture:

```
PostgreSQL Database
  ↓
Database Schema (tables, columns, constraints)
  ↓
Metadata Views (schema_entities, schema_properties)
  ↓
SchemaService (Angular) - Fetches and caches metadata
  ↓
DataService (Angular) - Performs CRUD via PostgREST
  ↓
Dynamic Pages (List/Detail/Create/Edit) - Auto-generated UI
  ↓
Smart Components (DisplayProperty/EditProperty) - Adapt to property types
```

**Key Services**:
- **SchemaService** - Manages entity and property metadata, determines types
- **DataService** - Handles all PostgREST API calls with filtering and ordering
- **AuthService** - Keycloak integration for authentication and role management
- **PermissionsService** - Manages database-driven RBAC permissions

**Property Type System**: Maps PostgreSQL types to UI components (e.g., `int4 + join_column` → Dropdown, `geography(Point)` → Interactive Map)

## Project Structure

```
src/app/
├── components/          # Reusable UI components
│   ├── display-property/  # Read-only property display
│   ├── edit-property/     # Editable form inputs
│   ├── geo-point-map/     # Leaflet map for geography
│   └── dialog/            # Error/success dialogs
├── pages/               # Route-driven pages
│   ├── list/            # Table view of entities
│   ├── detail/          # Single record view
│   ├── create/          # Create new record
│   ├── edit/            # Edit existing record
│   ├── permissions/     # Admin RBAC management
│   ├── entity-management/  # Admin entity configuration
│   └── schema-erd/      # Database diagram viewer
├── services/            # Business logic and API
│   ├── schema.service.ts      # Metadata management
│   ├── data.service.ts        # CRUD operations
│   ├── auth.service.ts        # Authentication
│   └── permissions.service.ts # RBAC management
└── interfaces/          # TypeScript interfaces

example/                 # Docker Compose setup
├── docker-compose.yml   # PostgreSQL + PostgREST + Keycloak
├── init-scripts/        # Database initialization
└── postgres/            # Core schema and RBAC setup

postgres/                # Shared PostgreSQL scripts
├── 0_postgis_setup.sql       # PostGIS extension
├── 1_postgrest_setup.sql     # PostgREST roles and RLS
├── 2_rbac_functions.sql      # Permission checking functions
├── 3_civic_os_schema.sql     # Metadata tables and views
└── 4_rbac_sample_data.sql    # Default roles
```

## Documentation

- **[AUTHENTICATION.md](./AUTHENTICATION.md)** - Complete Keycloak setup guide for testing RBAC features
- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive developer guide, architecture details, and coding patterns
- **[example/README.md](./example/README.md)** - Docker Compose setup instructions
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues and solutions (especially RBAC configuration)
- **[ROADMAP.md](./ROADMAP.md)** - Development roadmap and feature tracking

## Adding a New Entity

Civic OS automatically generates UI for any table in the `public` schema:

1. **Create your table** in PostgreSQL:
   ```sql
   CREATE TABLE public."MyEntity" (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     description TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

2. **Grant permissions** to PostgREST roles:
   ```sql
   GRANT SELECT, INSERT, UPDATE, DELETE ON public."MyEntity" TO authenticated;
   ```

3. **Navigate to `/view/MyEntity`** - The UI is auto-generated!

4. **(Optional) Customize** via `metadata.entities` and `metadata.properties` tables for display names, descriptions, field ordering, etc.

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns (see CLAUDE.md)
- Tests pass (`npm test`)
- Commit messages are clear and concise

## License

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

Copyright (C) 2023-2025 Civic OS, L3C

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.

**Note**: The AGPL requires that if you modify this software and provide it as a service over a network, you must make your modified source code available to users of that service.
