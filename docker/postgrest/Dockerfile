# Copyright (C) 2023-2025 Civic OS, L3C
# AGPL-3.0-or-later

FROM postgrest/postgrest:v13.0.7

# Switch to root to install packages
USER root

# Install dependencies for JWKS fetching
RUN apk add --no-cache \
    curl \
    jq \
    bash

# Copy JWKS fetch script
COPY docker/postgrest/fetch-keycloak-jwk.sh /usr/local/bin/fetch-keycloak-jwk.sh
RUN chmod +x /usr/local/bin/fetch-keycloak-jwk.sh

# Copy custom entrypoint
COPY docker/postgrest/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for JWKS file
RUN mkdir -p /etc/postgrest && \
    chown -R 1000:1000 /etc/postgrest

# Switch back to postgrest user
USER 1000

# Set custom entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
