#!/bin/bash
# Civic OS Migration Generator
#
# Generates a new Sqitch migration by comparing dev database to clean baseline.
# Uses Atlas to auto-generate deploy/revert scripts and creates comprehensive
# verification that ensures schema consistency.
#
# Usage:
#   ./scripts/generate-migration.sh <note> ["description"]
#
# Examples:
#   ./scripts/generate-migration.sh add_tags_table "Add tags table for issue categorization"
#   ./scripts/generate-migration.sh rbac_enhancements "Enhance RBAC with group permissions"
#
# Migration Naming Convention:
#   Migrations are named: v<major>-<minor>-<patch>-<note>
#   Example: v0-4-0-add_tags_table
#   This ties migrations to release versions and ensures sortability.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
NOTE="$1"
DESCRIPTION="$2"

if [ -z "$NOTE" ]; then
  echo -e "${RED}Error: Migration note is required${NC}"
  echo ""
  echo "Usage: $0 <note> [\"description\"]"
  echo ""
  echo "Examples:"
  echo "  $0 add_tags_table \"Add tags table for issue categorization\""
  echo "  $0 rbac_enhancements \"Enhance RBAC with group permissions\""
  echo ""
  echo "Note: Use snake_case for the note (e.g., add_tags_table, not 'Add Tags Table')"
  exit 1
fi

# Extract version from package.json
PACKAGE_VERSION=$(node -p "require('./package.json').version")
VERSION_PREFIX=$(echo "$PACKAGE_VERSION" | sed 's/\./-/g')
MIGRATION_NAME="v${VERSION_PREFIX}-${NOTE}"

if [ -z "$DESCRIPTION" ]; then
  DESCRIPTION="$NOTE"
fi

echo -e "${GREEN}===================================="
echo "Civic OS Migration Generator"
echo -e "====================================${NC}"
echo "Version: $PACKAGE_VERSION"
echo "Migration: $MIGRATION_NAME"
echo "Description: $DESCRIPTION"
echo ""

# Configuration
DEV_DB_URL=${DEV_DB_URL:-"postgres://postgres:postgres@localhost:5432/civic_os"}
TEMP_CONTAINER="civic_os_migration_baseline_$(date +%s)"
TEMP_PORT=5433
CLEAN_DB_URL="postgres://postgres:postgres@localhost:${TEMP_PORT}/civic_os_clean"
MIGRATIONS_DIR="postgres/migrations"

# Check dependencies
echo -e "${BLUE}Checking dependencies...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}Error: Docker is not installed${NC}"
  exit 1
fi

if ! command -v sqitch &> /dev/null; then
  echo -e "${RED}Error: Sqitch is not installed${NC}"
  echo "Install with: brew install sqitch --with-postgres-support"
  exit 1
fi

if ! command -v atlas &> /dev/null; then
  echo -e "${RED}Error: Atlas is not installed${NC}"
  echo "Install with: brew install ariga/tap/atlas"
  exit 1
fi

if ! command -v psql &> /dev/null; then
  echo -e "${RED}Error: PostgreSQL client (psql) is not installed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ All dependencies found${NC}"
echo ""

# Check if dev database is accessible
echo -e "${BLUE}Checking dev database connection...${NC}"
if ! psql "$DEV_DB_URL" -c 'SELECT 1' &> /dev/null; then
  echo -e "${RED}Error: Cannot connect to dev database${NC}"
  echo "URL: $DEV_DB_URL"
  echo ""
  echo "Make sure your dev database is running:"
  echo "  docker-compose up -d db"
  exit 1
fi
echo -e "${GREEN}✓ Dev database accessible${NC}"
echo ""

# Check if migration already exists
if [ -f "$MIGRATIONS_DIR/deploy/${MIGRATION_NAME}.sql" ]; then
  echo -e "${RED}Error: Migration already exists${NC}"
  echo "File: $MIGRATIONS_DIR/deploy/${MIGRATION_NAME}.sql"
  echo ""
  echo "Choose a different note or delete the existing migration."
  exit 1
fi

# Step 1: Start temporary clean database
echo -e "${BLUE}Step 1: Starting temporary clean database...${NC}"
docker run -d \
  --name "$TEMP_CONTAINER" \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=civic_os_clean \
  -p ${TEMP_PORT}:5432 \
  postgis/postgis:17-3.5 \
  > /dev/null

# Wait for database to be ready
echo -n "Waiting for clean database to be ready"
for i in {1..30}; do
  if docker exec "$TEMP_CONTAINER" pg_isready -U postgres &> /dev/null; then
    echo -e " ${GREEN}✓${NC}"
    break
  fi
  echo -n "."
  sleep 1
done

if ! docker exec "$TEMP_CONTAINER" pg_isready -U postgres &> /dev/null; then
  echo -e " ${RED}✗${NC}"
  echo -e "${RED}Error: Clean database failed to start${NC}"
  docker logs "$TEMP_CONTAINER"
  docker stop "$TEMP_CONTAINER" &> /dev/null
  docker rm "$TEMP_CONTAINER" &> /dev/null
  exit 1
fi

echo ""

# Cleanup function
cleanup() {
  echo ""
  echo -e "${BLUE}Cleaning up temporary resources...${NC}"
  docker stop "$TEMP_CONTAINER" &> /dev/null || true
  docker rm "$TEMP_CONTAINER" &> /dev/null || true
  rm -rf /tmp/civic_os_atlas_${TEMP_CONTAINER}
  echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Register cleanup on exit
trap cleanup EXIT

# Step 2: Apply existing migrations to clean database
echo -e "${BLUE}Step 2: Applying existing migrations to clean database...${NC}"

if [ -f "sqitch.plan" ] && [ -s "sqitch.plan" ]; then
  # Skip header lines and count migrations
  MIGRATION_COUNT=$(grep -v "^%" sqitch.plan | grep -v "^$" | grep -v "^#" | wc -l | tr -d ' ')

  if [ "$MIGRATION_COUNT" -gt 0 ]; then
    echo "Found $MIGRATION_COUNT existing migration(s)"

    if sqitch deploy "$CLEAN_DB_URL" --verify; then
      echo -e "${GREEN}✓ Existing migrations applied${NC}"
    else
      echo -e "${RED}Error: Failed to apply existing migrations to clean database${NC}"
      echo ""
      echo "This means your existing migrations have issues."
      echo "Please fix existing migrations before creating new ones."
      exit 1
    fi
  else
    echo -e "${YELLOW}No existing migrations found - this will be the first migration${NC}"
  fi
else
  echo -e "${YELLOW}No sqitch.plan found - this will be the first migration${NC}"
fi

echo ""

# Step 3: Use Atlas to generate migration diff
echo -e "${BLUE}Step 3: Generating migration diff with Atlas...${NC}"

ATLAS_TEMP_DIR="/tmp/civic_os_atlas_${TEMP_CONTAINER}"
mkdir -p "$ATLAS_TEMP_DIR"

# Atlas requires a dev database for schema diffing
echo "Creating Atlas migration directory..."

# Generate migration using Atlas
# NOTE: We only diff core Civic OS objects (metadata.* + specific public objects)
echo "Running Atlas diff (this may take a moment)..."

# First, inspect the current dev database schema
echo "Inspecting dev database..."
atlas schema inspect \
  --url "$DEV_DB_URL" \
  --exclude "public.issue*" \
  --exclude "public.tag*" \
  --exclude "public.statu*" \
  --exclude "public.spatial_ref_sys" \
  > "${ATLAS_TEMP_DIR}/dev_schema.hcl" 2>&1 || {
    echo -e "${RED}Error: Atlas schema inspection failed${NC}"
    cat "${ATLAS_TEMP_DIR}/dev_schema.hcl"
    exit 1
  }

# Inspect clean database schema
echo "Inspecting clean database..."
atlas schema inspect \
  --url "$CLEAN_DB_URL" \
  --exclude "public.spatial_ref_sys" \
  > "${ATLAS_TEMP_DIR}/clean_schema.hcl" 2>&1 || {
    echo -e "${RED}Error: Atlas schema inspection failed${NC}"
    cat "${ATLAS_TEMP_DIR}/clean_schema.hcl"
    exit 1
  }

# Generate diff (from clean to dev = what changed)
echo "Generating diff..."
atlas schema diff \
  --from "file://${ATLAS_TEMP_DIR}/clean_schema.hcl" \
  --to "file://${ATLAS_TEMP_DIR}/dev_schema.hcl" \
  --dev-url "docker://postgres/17/dev" \
  > "${ATLAS_TEMP_DIR}/migration.sql" 2>&1

# Check if there are any changes
if [ ! -s "${ATLAS_TEMP_DIR}/migration.sql" ] || ! grep -q "ALTER\|CREATE\|DROP" "${ATLAS_TEMP_DIR}/migration.sql"; then
  echo -e "${YELLOW}Warning: No schema changes detected between dev and clean databases${NC}"
  echo ""
  echo "This could mean:"
  echo "  1. You haven't made any schema changes in dev"
  echo "  2. The changes are in user application tables (not core Civic OS)"
  echo "  3. The changes haven't been applied to dev database yet"
  echo ""
  echo "Please verify your schema changes and try again."
  exit 1
fi

echo -e "${GREEN}✓ Atlas diff generated${NC}"
echo ""

# Step 4: Create Sqitch migration structure
echo -e "${BLUE}Step 4: Creating Sqitch migration...${NC}"

# Determine the previous migration to set as dependency
LAST_MIGRATION=$(grep -v "^%" sqitch.plan 2>/dev/null | grep -v "^$" | grep -v "^#" | tail -1 | awk '{print $1}')

if [ -n "$LAST_MIGRATION" ]; then
  REQUIRES_FLAG="--requires $LAST_MIGRATION"
  echo "Setting dependency: $LAST_MIGRATION"
else
  REQUIRES_FLAG=""
  echo "No previous migrations found"
fi

# Add migration to sqitch
sqitch add "$MIGRATION_NAME" \
  --note "$DESCRIPTION" \
  $REQUIRES_FLAG

echo -e "${GREEN}✓ Sqitch migration structure created${NC}"
echo ""

# Step 5: Populate deploy.sql
echo -e "${BLUE}Step 5: Creating deploy script...${NC}"

cat > "$MIGRATIONS_DIR/deploy/${MIGRATION_NAME}.sql" << EOF
-- Deploy civic_os:${MIGRATION_NAME} to pg
EOF

if [ -n "$LAST_MIGRATION" ]; then
  echo "-- requires: ${LAST_MIGRATION}" >> "$MIGRATIONS_DIR/deploy/${MIGRATION_NAME}.sql"
fi

cat >> "$MIGRATIONS_DIR/deploy/${MIGRATION_NAME}.sql" << EOF

BEGIN;

-- Atlas auto-generated migration
-- Review and enhance with metadata insertions, grants, and RLS policies

$(cat "${ATLAS_TEMP_DIR}/migration.sql")

COMMIT;
EOF

echo -e "${GREEN}✓ Deploy script created${NC}"
echo ""

# Step 6: Populate revert.sql
echo -e "${BLUE}Step 6: Creating revert script...${NC}"

# For revert, we need to reverse the migration
# Atlas doesn't auto-generate revert, so we'll create a template
cat > "$MIGRATIONS_DIR/revert/${MIGRATION_NAME}.sql" << 'EOF'
-- Revert civic_os:${MIGRATION_NAME} from pg

BEGIN;

-- TODO: Manually write revert logic
-- This should undo the changes in deploy/${MIGRATION_NAME}.sql
--
-- Common patterns:
--   CREATE TABLE -> DROP TABLE IF EXISTS
--   ALTER TABLE ADD COLUMN -> ALTER TABLE DROP COLUMN IF EXISTS
--   CREATE FUNCTION -> DROP FUNCTION IF EXISTS
--   INSERT INTO metadata.* -> DELETE FROM metadata.* WHERE ...

-- PLACEHOLDER: Review deploy script and write corresponding revert statements

ROLLBACK;
EOF

# Replace placeholder with actual migration name
sed -i '' "s/\${MIGRATION_NAME}/${MIGRATION_NAME}/g" "$MIGRATIONS_DIR/revert/${MIGRATION_NAME}.sql"

echo -e "${YELLOW}⚠ Revert script created (requires manual completion)${NC}"
echo ""

# Step 7: Create verify script with full schema comparison
echo -e "${BLUE}Step 7: Creating verify script...${NC}"

# Export expected schema from dev database
pg_dump "$DEV_DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=information_schema \
  --exclude-schema=pg_catalog \
  --exclude-table=spatial_ref_sys \
  > "$MIGRATIONS_DIR/verify/${MIGRATION_NAME}.expected.sql"

# Create verify script that does quick checks
cat > "$MIGRATIONS_DIR/verify/${MIGRATION_NAME}.sql" << 'EOF'
-- Verify civic_os:${MIGRATION_NAME} on pg

BEGIN;

-- Quick structural checks (add specific checks for your changes)
-- Example:
-- SELECT 1/COUNT(*) FROM pg_catalog.pg_tables WHERE tablename = 'your_table';
-- SELECT 1/COUNT(*) FROM pg_catalog.pg_type WHERE typname = 'your_domain';
-- SELECT 1/COUNT(*) FROM pg_catalog.pg_proc WHERE proname = 'your_function';

-- TODO: Add specific verification checks for this migration

ROLLBACK;
EOF

# Replace placeholder
sed -i '' "s/\${MIGRATION_NAME}/${MIGRATION_NAME}/g" "$MIGRATIONS_DIR/verify/${MIGRATION_NAME}.sql"

echo -e "${GREEN}✓ Verify script created${NC}"
echo -e "${BLUE}  - Quick verify: $MIGRATIONS_DIR/verify/${MIGRATION_NAME}.sql${NC}"
echo -e "${BLUE}  - Full schema: $MIGRATIONS_DIR/verify/${MIGRATION_NAME}.expected.sql${NC}"
echo ""

# Step 8: Summary
echo -e "${GREEN}===================================="
echo "Migration Generated Successfully!"
echo -e "====================================${NC}"
echo ""
echo -e "${BLUE}Migration Details:${NC}"
echo "  Name: $MIGRATION_NAME"
echo "  Description: $DESCRIPTION"
echo "  Version: $PACKAGE_VERSION"
echo ""
echo -e "${BLUE}Files Created:${NC}"
echo "  ✓ $MIGRATIONS_DIR/deploy/${MIGRATION_NAME}.sql"
echo "  ✓ $MIGRATIONS_DIR/revert/${MIGRATION_NAME}.sql ${YELLOW}(needs completion)${NC}"
echo "  ✓ $MIGRATIONS_DIR/verify/${MIGRATION_NAME}.sql ${YELLOW}(needs enhancement)${NC}"
echo "  ✓ $MIGRATIONS_DIR/verify/${MIGRATION_NAME}.expected.sql"
echo "  ✓ sqitch.plan (updated)"
echo ""
echo -e "${YELLOW}⚠ Next Steps (IMPORTANT):${NC}"
echo ""
echo "1. Review deploy script and add metadata coordination:"
echo "   ${BLUE}nano $MIGRATIONS_DIR/deploy/${MIGRATION_NAME}.sql${NC}"
echo "   - Add INSERT INTO metadata.entities"
echo "   - Add INSERT INTO metadata.properties"
echo "   - Add GRANT statements for authenticated role"
echo "   - Add RLS policies if needed"
echo ""
echo "2. Complete the revert script:"
echo "   ${BLUE}nano $MIGRATIONS_DIR/revert/${MIGRATION_NAME}.sql${NC}"
echo "   - Write logic to undo deploy changes"
echo "   - Test that revert works correctly"
echo ""
echo "3. Enhance verify script with specific checks:"
echo "   ${BLUE}nano $MIGRATIONS_DIR/verify/${MIGRATION_NAME}.sql${NC}"
echo "   - Add checks for tables/columns/functions you added"
echo "   - Verify metadata entries exist"
echo ""
echo "4. Test the migration locally:"
echo "   ${BLUE}sqitch rebase dev --verify${NC}"
echo ""
echo "5. Test rollback:"
echo "   ${BLUE}sqitch revert dev --to @HEAD^${NC}"
echo "   ${BLUE}sqitch deploy dev --verify${NC}"
echo ""
echo "6. Commit to Git:"
echo "   ${BLUE}git add $MIGRATIONS_DIR/ sqitch.plan${NC}"
echo "   ${BLUE}git commit -m \"Add migration: $DESCRIPTION\"${NC}"
echo ""
echo -e "${GREEN}Migration generation complete!${NC}"
