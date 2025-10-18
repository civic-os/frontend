# Copyright (C) 2023-2025 Civic OS, L3C
# AGPL-3.0-or-later

# Official PostgREST images are built FROM scratch with only the static binary.
# To extend them, we copy the binary into a fuller base image per official docs:
# https://github.com/PostgREST/postgrest/tree/main/nix/tools/docker

FROM ubuntu:24.04

# Copy PostgREST binary from official image
COPY --from=postgrest/postgrest:v13.0.7 /bin/postgrest /bin/postgrest

# Install dependencies for JWKS fetching
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        jq \
        bash \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Copy JWKS fetch script
COPY docker/postgrest/fetch-keycloak-jwk.sh /usr/local/bin/fetch-keycloak-jwk.sh
RUN chmod +x /usr/local/bin/fetch-keycloak-jwk.sh

# Copy custom entrypoint
COPY docker/postgrest/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for JWKS file with proper ownership
# Note: Ubuntu 24.04 already has UID 1000 (ubuntu user), so we use it directly
RUN mkdir -p /etc/postgrest && \
    chown -R 1000:1000 /etc/postgrest

# Switch to non-root user for runtime security
USER 1000

# Set custom entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
