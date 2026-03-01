### Build stage
FROM node:22-alpine AS builder
RUN npm install -g bun

WORKDIR /app

COPY package.json bun.lockb* ./
COPY turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/logger/package.json ./packages/logger/
COPY packages/database/package.json ./packages/database/
COPY packages/redis/package.json ./packages/redis/
COPY packages/queue/package.json ./packages/queue/

# Copy all local packages before installing dependencies
COPY packages/ ./packages/
COPY apps/worker/package.json ./apps/worker/

RUN bun install --frozen-lockfile

# Copy app source
COPY apps/worker/ ./apps/worker/

RUN bun run build --filter=@saas/worker

### Production stage
FROM node:22-alpine AS runner

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

WORKDIR /app
ENV NODE_ENV=production

# Preserve full workspace layout for @saas/* package resolution
COPY --from=builder --chown=appuser:nodejs /app /app

WORKDIR /app/apps/worker

USER appuser

CMD ["node", "--import", "tsx", "dist/index.js"]
