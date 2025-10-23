# Civic OS Roadmap

This document outlines the development roadmap for Civic OS, organized by phases as described in the [Civic OS Vision](https://github.com/civic-os/vision).

## Phase 1: Development Tools

### Schema
- [x] Build Entity metadata table
- [x] Build Property metadata table
- [x] Build out User table with public and private fields
- [x] Show related Entities (inverse relationships)
- [x] Allow one-to-many and many-to-many Properties
- [x] Build scheme for editable Properties, default values, etc.
- [x] Add Form Validation Messages
- [x] Allow sorting/layout of Property Views/Lists
- [ ] Add User Profile and management
- [x] Add Login/Logout Screens (uses Keycloak Auth)
- [ ] Add File/Image data types (Priority 1: Unlocks many use cases)
- [x] Live update page as Schema is updated
- [x] Add Color PropertyType
- [ ] Configurable Entity Menu (Nesting, Hiding, Singular/Plural names)

- [ ] Prevent duplicate/cancelled dropdown queries (not changed)

#### List Pages
- [X] Add pagination
- [x] Add text search as an indexed column and toggle-able search box
- [x] Add Map view for List pages
- [x] Add Sortable columns and default sort
- [x] Add filter-able columns (mostly FK fields, but also expand to other indexed fields like datetime)
- [x] Add spreadsheet Import/Export capabilities

### Roles
- [x] Build Roles/Permissions schema
- [ ] Give Roles display name, description
- [x] Allow creation of Roles on the Permissions screen (or a role-specific screen)

### Workflow
- [ ] Build table structure for attaching workflow to Entity (Use Properties table)
- [ ] Build Trigger rules to restrict transitions
- [ ] Create Override Workflow permission
- [ ] Limit UI Selectors based on Workflow
- [ ] Set up Record Defaults (On Create)

### Logic
- [ ] Build manually triggerable Logic (via Button on Entity detail page)

### Dashboards (Phased Development)
- [x] **Phase 1 - Core Infrastructure**: Database schema, widget registry, markdown widget, static dashboard with navigation
- [ ] **Phase 2 - Dynamic Widgets**: Filtered list widget, auto-refresh infrastructure, data freshness UX
- [ ] **Phase 3 - Management**: Dashboard management UI, widget editor, user preferences, global filter bar
- [ ] **Phase 4 - Polish**: Drag-and-drop reordering, dashboard templates, embedded links, mobile optimizations
- [ ] **Phase 5 - Advanced Widgets**: Stat cards (backend aggregation required), charts (Chart.js), query results from views
- [ ] **Phase 6 - Permissions**: Role-based visibility, widget-level permissions, private dashboards

### General
- [ ] ADA/WCAG Compatibility
- [ ] Allow Angular app to be configured at container runtime (for flexible deployments)
- [ ] Save selected Theme in localstorage and use on reload
- [ ] Allow user profile editing (through keycloak?)
- [ ] App and Database update deployments
- [ ] Automatically assign new users the "user" role
- [ ] Title updates (configure base from Angular Runtime)
- [ ] Application Logging from frontend and pattern for SQL logging

## Phase 2: Introspection Tools

### Schema
- [x] Build automatic generation of Entity Relationship Diagrams showing how schema works
- [x] Permit other relationship types (one-to-one, many-to-many)
- [ ] Advanced Form Validation by use of RPCs
- [ ] Add customizable template pages (primarily for PDF)
- [ ] Research safe database schema editing, sandboxing
- [ ] One-to-One relationship created as child record
  - [ ] Grouped on Detail Page
  - [ ] Grouped on ERD
  - [ ] Multi-step create forms
- [ ] ERD zoom and pan
- [ ] Use postgres Schemas to builder larger, modular apps

### Workflow
- [ ] Build automatic generation of Workflow diagrams showing how workflows operate

### Logic
- [ ] Build automatic generation of Block Diagrams showing how Logic works

### Utilities
- [ ] Build notification service

## Phase 3: Graphical Editing Tools

### Schema
- [ ] Build GUI editor for Entity Relationship Diagrams
- [ ] Allow creating new columns on an existing entity
- [ ] Allow creation/modification of text search columns

### Workflow
- [ ] Build GUI editor for Workflow diagrams showing how workflows operate

### Logic
- [ ] Build GUI editor for Block Diagrams showing how Logic works

---

For more details on the vision behind these phases, see the [Civic OS Vision repository](https://github.com/civic-os/vision).
