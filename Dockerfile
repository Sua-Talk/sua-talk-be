# Multi-stage build for optimal CapRover deployment
FROM node:18-alpine AS base

# Install system dependencies (including optional FFmpeg)
RUN apk update && \
    apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/audio-recordings && \
    mkdir -p uploads/temp && \
    chmod 755 uploads

# Production stage
FROM node:18-alpine AS production

# Install minimal runtime dependencies (including optional FFmpeg)
RUN apk add --no-cache \
    ffmpeg \
    && rm -rf /var/cache/apk/*

WORKDIR /usr/src/app

# Copy built application from base stage
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY --from=base /usr/src/app .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set proper permissions
RUN chown -R nodejs:nodejs /usr/src/app
USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Expose port
EXPOSE 80

# Start application
CMD ["npm", "start"] 