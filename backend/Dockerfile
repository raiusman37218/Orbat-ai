# ==========================================
# Multi-stage Dockerfile for Orbat AI NestJS Backend API
# ==========================================

# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Install dumb-init and curl for robust signal handling & healthchecks
RUN apk add --no-cache dumb-init curl

# Create non-root user
USER node

# Copy built artifacts and runtime dependencies
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health/live || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]

