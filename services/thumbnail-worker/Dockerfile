FROM node:20-alpine

# Install system dependencies for Sharp (images) and Poppler (PDFs)
RUN apk add --no-cache \
    libc6-compat \
    vips-dev \
    build-base \
    python3 \
    poppler-utils \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy worker code
COPY thumbnail-worker.js ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('pg').Client; process.exit(0)" || exit 1

# Run worker
CMD ["node", "thumbnail-worker.js"]
