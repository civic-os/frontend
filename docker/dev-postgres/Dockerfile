# Development Postgres + PostGIS + Sqitch Image
#
# This image combines PostGIS with Sqitch for running migrations during
# local development. It allows init scripts to run sqitch commands.
#
# Uses Debian-based PostGIS image to leverage apt-get for sqitch installation
#
# Build: docker build -f docker/dev-postgres/Dockerfile -t civic-os-dev-postgres .
# Use: See example/docker-compose.yml

FROM postgis/postgis:17-3.5

# Install sqitch and PostgreSQL engine from Debian repositories
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqitch \
    libdbd-pg-perl \
    && rm -rf /var/lib/apt/lists/*

# Verify sqitch is installed and working
RUN sqitch --version

# The postgres image will use /docker-entrypoint-initdb.d for init scripts
# No additional configuration needed here
