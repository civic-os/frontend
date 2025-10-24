#!/bin/bash
# Civic OS Full Schema Verification Script
#
# This script performs comprehensive schema verification by comparing the actual
# database schema to the expected schema captured during migration generation.
#
# It is optionally run during migrations when CIVIC_OS_VERIFY_FULL=true is set.
# The quick verify.sql scripts run on every deployment, but this comprehensive
# check is recommended for:
#   - Production deployments
#   - CI/CD pipelines
#   - Release validation
#   - Detecting schema drift
#
# Usage:
#   CIVIC_OS_VERIFY_FULL=true sqitch deploy
#   or
#   ./postgres/migrations/scripts/verify-full.sh <migration_name> <database_url>
#
# Environment Variables:
#   CIVIC_OS_VERIFY_FULL - Set to "true" to enable (default: false)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MIGRATION_NAME="$1"
DATABASE_URL="${2:-$SQITCH_TARGET}"

# Check if full verification is enabled
if [ "$CIVIC_OS_VERIFY_FULL" != "true" ]; then
  echo "Full verification skipped (set CIVIC_OS_VERIFY_FULL=true to enable)"
  exit 0
fi

if [ -z "$MIGRATION_NAME" ]; then
  echo -e "${RED}Error: Migration name required${NC}"
  echo "Usage: $0 <migration_name> [database_url]"
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: Database URL required${NC}"
  echo "Set SQITCH_TARGET or pass as second argument"
  exit 1
fi

EXPECTED_SCHEMA="postgres/migrations/verify/${MIGRATION_NAME}.expected.sql"

if [ ! -f "$EXPECTED_SCHEMA" ]; then
  echo -e "${YELLOW}Warning: Expected schema file not found${NC}"
  echo "File: $EXPECTED_SCHEMA"
  echo "Skipping full verification"
  exit 0
fi

echo "===================================="
echo "Full Schema Verification"
echo "===================================="
echo "Migration: $MIGRATION_NAME"
echo "Database: ${DATABASE_URL%%:*@*}:****@****"
echo ""

# Export actual schema
echo "Exporting actual schema..."
ACTUAL_SCHEMA="/tmp/civic_os_actual_${MIGRATION_NAME}_$(date +%s).sql"

pg_dump "$DATABASE_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=information_schema \
  --exclude-schema=pg_catalog \
  --exclude-table=spatial_ref_sys \
  > "$ACTUAL_SCHEMA"

# Compare schemas
echo "Comparing schemas..."

# Use diff to compare (ignoring comments and whitespace differences)
if diff -u \
  --ignore-all-space \
  --ignore-blank-lines \
  --ignore-matching-lines="^--" \
  "$EXPECTED_SCHEMA" \
  "$ACTUAL_SCHEMA" \
  > /tmp/schema_diff_${MIGRATION_NAME}.txt 2>&1; then

  echo -e "${GREEN}✓ Schema verification passed${NC}"
  echo "Actual schema matches expected schema"
  rm -f "$ACTUAL_SCHEMA" /tmp/schema_diff_${MIGRATION_NAME}.txt
  exit 0
else
  echo -e "${RED}✗ Schema verification failed${NC}"
  echo ""
  echo "Differences found between expected and actual schemas:"
  echo "===================================="
  cat /tmp/schema_diff_${MIGRATION_NAME}.txt
  echo "===================================="
  echo ""
  echo "Expected: $EXPECTED_SCHEMA"
  echo "Actual:   $ACTUAL_SCHEMA"
  echo "Diff:     /tmp/schema_diff_${MIGRATION_NAME}.txt"
  echo ""
  echo "This could indicate:"
  echo "  - Schema drift (manual changes not in migrations)"
  echo "  - Migration did not apply completely"
  echo "  - Expected schema file is outdated"
  exit 1
fi
