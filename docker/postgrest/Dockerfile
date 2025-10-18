# Copyright (C) 2023-2025 Civic OS, L3C
# AGPL-3.0-or-later

FROM postgrest/postgrest:v13.0.7

# Switch to root using numeric UID (PostgREST base image runs as non-root)
USER 0

# Install dependencies for JWKS fetching
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        jq \
        bash && \
    rm -rf /var/lib/apt/lists/*

# Copy JWKS fetch script
COPY docker/postgrest/fetch-keycloak-jwk.sh /usr/local/bin/fetch-keycloak-jwk.sh
RUN chmod +x /usr/local/bin/fetch-keycloak-jwk.sh

# Copy custom entrypoint
COPY docker/postgrest/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for JWKS file with proper ownership
RUN mkdir -p /etc/postgrest && \
    chown -R 1000:1000 /etc/postgrest

# Switch to non-root postgrest user for runtime security
USER 1000

# Set custom entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
