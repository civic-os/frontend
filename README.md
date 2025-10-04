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
- [x] Build Roles/Permissions schema
- [ ] Allow one-to-many and many-to-many Properties
- [ ] Build scheme for editable Properties, default values, etc.
- [ ] Add Form Validation Messages
- [ ] Allow sorting/layout of Property Views/Lists
- [ ] Add User Profile and management
- [ ] Add Login/Logout Screens
- [ ] Set up default tables (id, created_at, updated_at, updated_at_trigger, permissions)
- [ ] Expand Form Validation by use of `CHECK` statements
### Workflow
- [ ] Build table structure for attaching workflow to Entity (Use Properties table)
- [ ] Build Trigger rules to restrict transitions
- [ ] Create Override Workflow permission
- [ ] Limit UI Selectors based on Workflow
- [ ] Set up Record Defaults (On Create)
### Logic
- [ ] Build Logic

## Documentation
For detailed setup and usage instructions, see:
- [CLAUDE.md](./CLAUDE.md) - Comprehensive developer guide and architecture documentation
- [example/README.md](./example/README.md) - Docker Compose setup with PostgreSQL, PostgREST, and Keycloak
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions, especially for RBAC configuration