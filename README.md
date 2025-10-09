# Civic OS App
## Vision
For more background information on Civic OS, read [Civic OS Vision](https://github.com/civic-os/vision)
## Brief Technical Description
This application automatically generates views for listing, detailing, creating, and editing data stored in the `public` schema of an attached PostgreSQL database. It relies on a PostgREST server attached to said database and expects the scripts located in the `postgres` folder to be executed on that database as well.
## To Do [(Phase 1)](https://github.com/civic-os/vision#phase-1-development-tools)
### Schema
- [x] Build Entity metadata table
- [x] Build Property metadata table
- [x] Build out User table with public and private fields
- [ ] Allow one-to-many and many-to-many Properties
- [x] Build scheme for editable Properties, default values, etc.
- [ ] Add Form Validation Messages
- [x] Allow sorting/layout of Property Views/Lists
- [ ] Add User Profile and management
- [x] Add Login/Logout Screens (uses Keycloak Auth)
- [ ] Set up default tables (id, created_at, updated_at, updated_at_trigger, permissions)
- [ ] Expand Form Validation by use of `CHECK` statements
- [ ] Add File/Image data types
#### List Pages
- [ ] Add List page configuration on top of Properties Management page
- [ ] Add pagination
- [ ] Add text search as an indexed column and toggle-able search box
- [ ] Add Map view for List pages
- [ ] Add Sortable columns and default sort
- [ ] Add filter-able columns (mostly FK fields, but also expand to other indexed fields like datetime)
### Roles
- [x] Build Roles/Permissions schema
- [ ] Give Roles display name, description
- [ ] Allow creation of Roles on the Permissions screen (or a role-specific screen)
### Workflow
- [ ] Build table structure for attaching workflow to Entity (Use Properties table)
- [ ] Build Trigger rules to restrict transitions
- [ ] Create Override Workflow permission
- [ ] Limit UI Selectors based on Workflow
- [ ] Set up Record Defaults (On Create)
### Logic
- [ ] Build manually triggerable Logic (via Button on Entity page)
### General
- [ ] ADA/WCAG Compatibility
- [ ] SOC II Compliance
- [ ] Allow Angular app to be configured at container runtime (for flexible deployments)

## To Do [(Phase 2)](https://github.com/civic-os/vision#phase-2-introspection-tools)
### Schema
- [x] Build automatic generation of Entity Relationship Diagrams showing how schema works
- [ ] Permit other relationship types (one-to-one, many-to-many)
### Workflow
- [ ] Build automatic generation of Workflow diagrams showing how workflows operate
### Logic
- [ ] Build automatic generation of Block Diagrams showing how Logic works

## To Do [(Phase 3)](https://github.com/civic-os/vision#phase-3-graphical-editing-tools)
### Schema
- [ ] Build GUI editor for Entity Relationship Diagrams
### Workflow
- [ ] Build GUI editor for Workflow diagrams showing how workflows operate
### Logic
- [ ] Build GUI editor for Block Diagrams showing how Logic works

## Documentation
For detailed setup and usage instructions, see:
- [CLAUDE.md](./CLAUDE.md) - Comprehensive developer guide and architecture documentation
- [example/README.md](./example/README.md) - Docker Compose setup with PostgreSQL, PostgREST, and Keycloak
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions, especially for RBAC configuration