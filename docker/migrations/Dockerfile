# Civic OS Database Migration Container
#
# This container runs Sqitch migrations against a PostgreSQL database.
# It is versioned alongside the frontend and postgrest containers to ensure
# schema compatibility with the application.
#
# Usage:
#   docker run --rm \
#     -e PGRST_DB_URI="postgres://user:pass@host:5432/dbname" \
#     ghcr.io/civic-os/migrations:v0.4.0
#
# Environment Variables:
#   PGRST_DB_URI (required) - PostgreSQL connection string
#   SQITCH_VERIFY (optional) - Set to "false" to skip verification (default: "true")

FROM sqitch/sqitch:latest

# Copy Sqitch configuration and migrations
COPY sqitch.conf /migrations/sqitch.conf
COPY sqitch.plan /migrations/sqitch.plan
COPY postgres/migrations/ /migrations/postgres/migrations/

WORKDIR /migrations

# Entrypoint script to run migrations
COPY --chmod=755 docker/migrations/docker-entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["deploy"]
