#!/bin/sh
# Copyright (C) 2023-2025 Civic OS, L3C
# AGPL-3.0-or-later

set -e

echo "======================================"
echo "Civic OS Frontend Container Starting"
echo "======================================"

echo "Configuration:"
echo "  POSTGREST_URL: $POSTGREST_URL"
echo "  KEYCLOAK_URL: $KEYCLOAK_URL"
echo "  KEYCLOAK_REALM: $KEYCLOAK_REALM"
echo "  KEYCLOAK_CLIENT_ID: $KEYCLOAK_CLIENT_ID"
echo "  MAP_DEFAULT_LAT: $MAP_DEFAULT_LAT"
echo "  MAP_DEFAULT_LNG: $MAP_DEFAULT_LNG"
echo "  MAP_DEFAULT_ZOOM: $MAP_DEFAULT_ZOOM"
echo ""

# Generate config.js from template using environment variables
echo "Generating runtime config.js from environment variables..."
envsubst < /usr/share/nginx/html/assets/config.template.js > /usr/share/nginx/html/assets/config.js

echo "✓ Configuration file generated at /usr/share/nginx/html/assets/config.js"
echo ""
echo "======================================"
echo "Starting Nginx..."
echo "======================================"

# Execute the CMD (nginx)
exec "$@"
