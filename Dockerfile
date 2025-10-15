FROM node:20-alpine

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies with optimizations
# Using build cache mount for npm cache
RUN --mount=type=cache,target=/root/.npm \
    npm install --omit=dev --prefer-offline --no-audit --no-fund

# Copy version file
COPY VERSION ./VERSION

# Copy application files
COPY src/ ./src/

# Copy default configuration files for Docker
# These will be used if no external configs are mounted
COPY docker/.env ./.env
COPY docker/models.json ./models.json

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3333/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "src/server.js"]
