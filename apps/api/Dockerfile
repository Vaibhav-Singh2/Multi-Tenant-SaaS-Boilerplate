### Build stage
FROM node:22-alpine AS builder
RUN npm install -g bun

WORKDIR /app

# Copy workspace manifests
COPY package.json bun.lockb* ./
COPY turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/logger/package.json ./packages/logger/
COPY packages/database/package.json ./packages/database/
COPY packages/redis/package.json ./packages/redis/
COPY packages/auth/package.json ./packages/auth/
COPY packages/queue/package.json ./packages/queue/

# Copy all local packages before installing dependencies
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy app source
COPY apps/api/ ./apps/api/

# Build
RUN bun run build --filter=@saas/api

### Production stage
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

WORKDIR /app
ENV NODE_ENV=production

# Preserve full workspace layout for @saas/* package resolution
COPY --from=builder --chown=appuser:nodejs /app /app

WORKDIR /app/apps/api

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "--import", "tsx", "dist/index.js"]
