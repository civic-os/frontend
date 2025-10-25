FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Copy service code
COPY sign-service.js ./

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('pg').Client; process.exit(0)" || exit 1

# Run service
CMD ["node", "sign-service.js"]
