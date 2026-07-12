# Use Node.js 20 as the base image
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies if needed
# Copy package manifests first for efficient caching
COPY package*.json ./

# Install all dependencies (including devDependencies to build)
RUN npm ci

# Copy application source code
COPY . .

# Build the frontend and backend bundle
RUN npm run build

# --- Production Environment ---
FROM node:20-slim AS runner

WORKDIR /app

# Install ffmpeg and ffprobe for video exporting
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Ensure tmp and upload directories exist and are writable by non-root node user
RUN mkdir -p /app/tmp /app/upload && chown -R node:node /app

# Expose port 3000 for server traffic
EXPOSE 3000

# Switch to the non-root node user
USER node

# Healthcheck to verify service and ffmpeg binaries are functional
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.json()).then(data => data.status === 'ok' && data.ffmpeg && data.ffprobe ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start the full-stack server
CMD ["npm", "run", "start"]
