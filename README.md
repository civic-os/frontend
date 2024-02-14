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
- [ ] Build Roles/Permissions schema
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
# Angular Development
## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.