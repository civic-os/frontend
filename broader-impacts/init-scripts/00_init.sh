#!/bin/bash
set -e

# This script consolidates all Civic OS core scripts from the postgres directory
# and runs them in alphabetical order, followed by broader-impacts-specific scripts.

echo "======================================"
echo "Running Civic OS Core Scripts"
echo "======================================"

# Run all SQL scripts from the postgres directory in order
for script in /civic-os-core/*.sql; do
    if [ -f "$script" ]; then
        echo "Executing: $(basename $script)"
        psql -v ON_ERROR_STOP=1 -v authenticator_password="$POSTGRES_PASSWORD" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$script"
    fi
done

echo "======================================"
echo "Civic OS Core Scripts Complete"
echo "======================================"
