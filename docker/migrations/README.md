# Civic OS Migration Container

Versioned Docker container for running Sqitch database migrations against PostgreSQL databases. This container is automatically built and published to GitHub Container Registry with each release.

## Quick Start

```bash
docker run --rm \
  -e PGRST_DB_URI="postgres://user:pass@host:5432/dbname" \
  ghcr.io/civic-os/migrations:v0.4.0
```

## Published Images

Images are automatically published to GitHub Container Registry:

**Registry:** `ghcr.io/civic-os/migrations`

**Tags:**
- `latest` - Most recent build from main branch
- `v0.4.0` - Semantic version (with 'v' prefix)
- `0.4.0` - Semantic version (without 'v')
- `sha-abc1234` - Git commit SHA (for precise rollback)

## Environment Variables

### Required

**`PGRST_DB_URI`** - PostgreSQL connection string

Format: `postgres://user:password@host:port/database`

Examples:
```bash
# Local development
PGRST_DB_URI="postgres://postgres:postgres@localhost:5432/civic_os"

# Production with SSL
PGRST_DB_URI="postgres://user:pass@prod.example.com:5432/civic_os?sslmode=require"
```

### Optional

**`SQITCH_VERIFY`** - Enable/disable verification (default: `true`)

Set to `false` to skip verification:
```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  -e SQITCH_VERIFY="false" \
  ghcr.io/civic-os/migrations:v0.4.0
```

**`CIVIC_OS_VERIFY_FULL`** - Enable comprehensive schema verification (default: `false`)

Set to `true` for full schema comparison (recommended for production):
```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  -e CIVIC_OS_VERIFY_FULL="true" \
  ghcr.io/civic-os/migrations:v0.4.0
```

## Commands

The container accepts Sqitch commands as arguments.

### Deploy Migrations (default)

```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0
```

Or explicitly:
```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0 \
  deploy --verify
```

### Show Migration Status

```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0 \
  status
```

### Revert Migrations

Rollback to previous migration:
```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0 \
  revert --to @HEAD^
```

Rollback to specific migration:
```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0 \
  revert --to v0-3-0-baseline
```

### Verify Schema

```bash
docker run --rm \
  -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0 \
  verify
```

## Usage Scenarios

### Docker Compose (Init Container)

```yaml
services:
  db:
    image: postgis/postgis:17-3.5
    # ... database config

  migrations:
    image: ghcr.io/civic-os/migrations:v0.4.0
    environment:
      PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/civic_os
    depends_on:
      db:
        condition: service_healthy
    restart: on-failure

  postgrest:
    image: ghcr.io/civic-os/postgrest:v0.4.0
    depends_on:
      migrations:
        condition: service_completed_successfully
    # ... postgrest config
```

### Kubernetes (Init Container)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: civic-os
spec:
  template:
    spec:
      initContainers:
        - name: migrations
          image: ghcr.io/civic-os/migrations:v0.4.0
          env:
            - name: PGRST_DB_URI
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: uri
            - name: CIVIC_OS_VERIFY_FULL
              value: "true"

      containers:
        - name: postgrest
          image: ghcr.io/civic-os/postgrest:v0.4.0
          # ... postgrest config
```

### CI/CD Pipeline

```yaml
# GitHub Actions
- name: Run database migrations
  run: |
    docker run --rm \
      --network host \
      -e PGRST_DB_URI="${{ secrets.DATABASE_URL }}" \
      -e CIVIC_OS_VERIFY_FULL="true" \
      ghcr.io/civic-os/migrations:${{ github.ref_name }}
```

### Manual Production Deployment

```bash
# Pull specific version
docker pull ghcr.io/civic-os/migrations:v0.4.0

# Run migrations
docker run --rm \
  --network host \
  -e PGRST_DB_URI="postgres://user:pass@prod-db:5432/civic_os" \
  -e CIVIC_OS_VERIFY_FULL="true" \
  ghcr.io/civic-os/migrations:v0.4.0

# Verify deployment
docker run --rm \
  --network host \
  -e PGRST_DB_URI="postgres://user:pass@prod-db:5432/civic_os" \
  ghcr.io/civic-os/migrations:v0.4.0 \
  status
```

## Version Matching

**CRITICAL:** Migration container version MUST match frontend/postgrest versions.

```bash
# ✅ Correct - all same version
ghcr.io/civic-os/migrations:v0.4.0
ghcr.io/civic-os/postgrest:v0.4.0
ghcr.io/civic-os/frontend:v0.4.0

# ❌ Wrong - version mismatch
ghcr.io/civic-os/migrations:v0.3.0  # Old migrations
ghcr.io/civic-os/postgrest:v0.4.0   # New API
ghcr.io/civic-os/frontend:v0.4.0    # New UI
# Result: Schema mismatch, application breaks
```

## Networking

The container needs network access to the PostgreSQL database.

### Docker Compose

Use Docker network:
```yaml
networks:
  civic-os-network:

services:
  migrations:
    networks:
      - civic-os-network
```

### Standalone Container

Use host network for local databases:
```bash
docker run --rm \
  --network host \
  -e PGRST_DB_URI="postgres://localhost:5432/civic_os" \
  ghcr.io/civic-os/migrations:v0.4.0
```

Or connect to external database:
```bash
docker run --rm \
  -e PGRST_DB_URI="postgres://user:pass@external-host:5432/civic_os" \
  ghcr.io/civic-os/migrations:v0.4.0
```

## Troubleshooting

### Connection Refused

**Error:** `could not connect to server: Connection refused`

**Solutions:**
- Check database is running: `docker ps | grep postgres`
- Verify network connectivity: `docker network ls`
- Use correct hostname (e.g., `db` in Docker Compose, `localhost` with `--network host`)

### Authentication Failed

**Error:** `FATAL: password authentication failed`

**Solutions:**
- Verify credentials in `PGRST_DB_URI`
- Check database user exists: `psql -U postgres -c "\du"`
- Ensure user has necessary permissions

### Migration Fails

**Error:** `deploy failed: ERROR at line X`

**Solutions:**
- Check migration syntax: review `deploy/vX-Y-Z-name.sql`
- Verify dependencies are deployed
- Check database logs: `docker logs <postgres-container>`
- Try deploying to test database first

### Verification Fails

**Error:** `Schema verification failed`

**Solutions:**
- Compare expected vs actual schema
- Check for manual hotfixes in production
- Regenerate expected schema if legitimate
- Review full verification output

### Permission Denied

**Error:** `ERROR: must be owner of table X`

**Solutions:**
- Connect as superuser (postgres)
- Update `PGRST_DB_URI` with correct user
- Grant necessary permissions to migration user

## Security Considerations

### Credentials

**Never log or expose database passwords:**
```bash
# ✅ Good - password masked in logs
docker run --rm \
  -e PGRST_DB_URI="$(cat /secrets/db_uri)" \
  ghcr.io/civic-os/migrations:v0.4.0

# ❌ Bad - password visible in logs/history
docker run --rm \
  -e PGRST_DB_URI="postgres://user:MySecretPassword@host:5432/db" \
  ghcr.io/civic-os/migrations:v0.4.0
```

### Production Safety

Use read-only verification before destructive operations:
```bash
# 1. Check status
docker run --rm -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0 status

# 2. Dry-run (if supported)
docker run --rm -e PGRST_DB_URI="..." \
  ghcr.io/civic-os/migrations:v0.4.0 deploy --dry-run

# 3. Deploy with full verification
docker run --rm -e PGRST_DB_URI="..." -e CIVIC_OS_VERIFY_FULL="true" \
  ghcr.io/civic-os/migrations:v0.4.0
```

## Building Locally

For development or testing:

```bash
# Build from repository root
docker build -t civic-os-migrations:local -f docker/migrations/Dockerfile .

# Run local build
docker run --rm \
  -e PGRST_DB_URI="postgres://localhost:5432/civic_os" \
  civic-os-migrations:local
```

## Additional Resources

- [Migration System Documentation](../../postgres/migrations/README.md)
- [Production Deployment Guide](../../docs/deployment/PRODUCTION.md)
- [Sqitch Documentation](https://sqitch.org/docs/)
- [GitHub Container Registry](https://github.com/orgs/civic-os/packages?repo_name=frontend)
