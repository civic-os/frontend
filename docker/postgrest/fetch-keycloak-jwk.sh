#!/bin/bash
# Copyright (C) 2023-2025 Civic OS, L3C
# AGPL-3.0-or-later

set -e  # Exit on error

# Verify required environment variables
if [ -z "$KEYCLOAK_URL" ] || [ -z "$KEYCLOAK_REALM" ]; then
    echo "Error: Missing required environment variables"
    echo "KEYCLOAK_URL and KEYCLOAK_REALM must be set"
    exit 1
fi

# Construct JWKS URL
JWKS_URL="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs"

echo "Fetching JWKS from: $JWKS_URL"

# Fetch JWKS with error handling
JWKS_JSON=$(curl -s -f "$JWKS_URL" 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$JWKS_JSON" ]; then
    echo "Error: Failed to fetch JWKS from Keycloak server"
    echo "Please verify:"
    echo "  - KEYCLOAK_URL is correct: $KEYCLOAK_URL"
    echo "  - KEYCLOAK_REALM is correct: $KEYCLOAK_REALM"
    echo "  - Keycloak server is accessible"
    exit 1
fi

# Validate JSON structure
if ! echo "$JWKS_JSON" | jq empty 2>/dev/null; then
    echo "Error: Keycloak returned invalid JSON"
    echo "Response:"
    echo "$JWKS_JSON"
    exit 1
fi

echo "Available keys in JWKS:"
echo "$JWKS_JSON" | jq -r '.keys[] | "  - kid: \(.kid), alg: \(.alg), use: \(.use // "sig")"'

# Use first RS256 key
echo ""
echo "Using first RS256 key..."
JWK=$(echo "$JWKS_JSON" | jq -c '.keys[] | select(.alg=="RS256")' | head -1)

if [ -z "$JWK" ]; then
    echo "Error: Could not extract RS256 JWK from JWKS"
    exit 1
fi

echo "Found JWK:"
echo "$JWK" | jq .

# Create JWKS format (wrap in keys array with only necessary fields)
OUTPUT_FILE="${1:-/etc/postgrest/jwt-secret.jwks}"
echo "{\"keys\": [$JWK]}" | jq '{keys: [.keys[] | {kid, kty, alg, use, n, e}]}' > "$OUTPUT_FILE"

echo ""
echo "✓ Successfully saved JWKS to $OUTPUT_FILE"
