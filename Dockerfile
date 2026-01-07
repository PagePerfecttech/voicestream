# Multi-stage build for production
FROM node:18-alpine AS builder

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    ffmpeg-dev

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install system dependencies for production
RUN apk add --no-cache \
    ffmpeg \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Copy additional files
COPY --chown=nodejs:nodejs media/ ./media/
COPY --chown=nodejs:nodejs scripts/ ./scripts/

# Create necessary directories
RUN mkdir -p /app/hls /app/logs && \
    chown -R nodejs:nodejs /app/hls /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]