# Multi-Tenant SaaS Boilerplate

A production-ready, multi-tenant SaaS boilerplate built on **Turborepo** with **Bun** as the package manager.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Internet                              │
│                           │                                  │
│                    ALB / Nginx                               │
│                           │                                  │
│          ┌────────────────┴────────────────┐                │
│          │                                 │                │
│   ┌──────▼──────┐                  ┌───────▼──────┐        │
│   │  apps/api   │                  │ apps/worker  │        │
│   │  Express    │                  │   BullMQ     │        │
│   └──────┬──────┘                  └───────┬──────┘        │
│          │                                 │                │
│          └────────────┬────────────────────┘                │
│                       │                                     │
│          ┌────────────┼────────────┐                        │
│          │            │            │                        │
│   ┌──────▼──┐  ┌──────▼──┐  ┌─────▼──────┐                │
│   │Postgres │  │  Redis  │  │Prometheus  │                │
│   │(tenant  │  │(ratelim │  │ + Grafana  │                │
│   │schemas) │  │+ queue) │  │ + Loki     │                │
│   └─────────┘  └─────────┘  └────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| Monorepo          | Turborepo + Bun                     |
| API Server        | Express.js                          |
| ORM               | Drizzle ORM (postgres.js)           |
| Multi-tenancy     | PostgreSQL schema-per-tenant        |
| Rate Limiting     | Redis sliding window                |
| Background Jobs   | BullMQ                              |
| Logging           | Winston → Loki (via Promtail)       |
| Metrics           | Prometheus + Grafana                |
| Unit Tests        | Vitest                              |
| Integration Tests | Supertest + Testcontainers          |
| Load Tests        | k6                                  |
| CI/CD             | GitHub Actions                      |
| Deployment        | AWS ECS Fargate + RDS + ElastiCache |

## Monorepo Structure

```
├── apps/
│   ├── api/           # Express REST API
│   └── worker/        # BullMQ background jobs
├── packages/
│   ├── config/        # Zod env validation
│   ├── types/         # Shared TypeScript interfaces
│   ├── logger/        # Winston + prom-client
│   ├── database/      # Drizzle ORM + tenant isolation
│   ├── redis/         # ioredis + rate limiter + cache
│   ├── auth/          # API key + JWT utilities
│   ├── queue/         # BullMQ queue definitions
│   └── testing/       # Testcontainers + Faker + matchers
├── docker/
│   ├── docker-compose.yml
│   └── observability/ # Prometheus, Loki, Promtail, Grafana
├── tests/
│   └── load/          # k6 load test scripts
├── .github/workflows/ # CI + CD
└── docs/
    └── aws-deployment.md
```

## Quick Start

### 1. Prerequisites

- [Bun](https://bun.sh) >= 1.3.8
- [Docker](https://docker.com) >= 24
- [Node.js](https://nodejs.org) >= 22

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
# Edit .env files with your configuration
```

### 4. Start all services (Docker)

```bash
bun run docker:up
```

This starts: **Postgres**, **Redis**, **API** (port 3000), **Worker**, **Prometheus** (9090), **Loki** (3100), **Grafana** (3001).

### 5. Run database migrations

```bash
bun run db:migrate
```

### 6. Create your first tenant

```bash
curl -X POST http://localhost:3000/admin/tenants \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: change-me-admin-secret" \
  -d '{"name": "Acme Corp", "slug": "acme"}'
```

Response includes a one-time `plainKey` — save it!

### 7. Make authenticated requests

```bash
curl http://localhost:3000/api/v1/usage \
  -H "X-API-Key: sk_<your-key>"
```

## API Endpoints

### Admin (requires `X-Admin-Secret` header)

| Method   | Path                            | Description              |
| -------- | ------------------------------- | ------------------------ |
| `POST`   | `/admin/tenants`                | Create tenant + API key  |
| `GET`    | `/admin/tenants`                | List all tenants         |
| `GET`    | `/admin/tenants/:id`            | Get tenant details       |
| `DELETE` | `/admin/tenants/:id`            | Delete tenant + schema   |
| `POST`   | `/admin/tenants/:id/rotate-key` | Rotate API key           |
| `GET`    | `/admin/queues`                 | Bull Board job dashboard |

### Tenant API (requires `X-API-Key` header)

| Method | Path                    | Description                           |
| ------ | ----------------------- | ------------------------------------- |
| `GET`  | `/api/v1/usage`         | Usage summary (+ `?from=&to=` dates)  |
| `GET`  | `/api/v1/usage/records` | Recent usage records                  |
| `POST` | `/webhooks/inbound`     | Receive webhook (queued for delivery) |
| `GET`  | `/health`               | Liveness + readiness check            |
| `GET`  | `/metrics`              | Prometheus metrics                    |

## Multi-Tenancy

Schema-based isolation — every tenant gets a dedicated PostgreSQL schema (`tenant_<slug>`) created on signup. API keys are hashed with SHA-256 and stored in the `public` schema. The `X-API-Key` header is resolved to a tenant on every request.

## Rate Limiting

Sliding window algorithm using Redis sorted sets (`ZADD` + `ZRANGEBYSCORE`). Limits are configurable per-tenant (`rateLimitPerMinute`). Rate limit headers are returned on every response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1708000000
```

Returns `429 Too Many Requests` when exceeded.

## Observability

| Service    | URL                                | Credentials   |
| ---------- | ---------------------------------- | ------------- |
| Grafana    | http://localhost:3001              | admin / admin |
| Prometheus | http://localhost:9090              | —             |
| Loki       | http://localhost:3100              | (via Grafana) |
| Bull Board | http://localhost:3000/admin/queues | —             |

## Testing

```bash
# Unit tests (auth package)
bun run test --filter=@saas/auth

# Integration tests (Redis ratelimit with real container)
bun run test --filter=@saas/redis

# All tests
bun run test

# Load tests (requires k6)
k6 run tests/load/smoke.js --env API_URL=http://localhost:3000
k6 run tests/load/ratelimit.js --env API_URL=http://localhost:3000 --env API_KEY=sk_xxx
```

## Deployment

See [docs/aws-deployment.md](./docs/aws-deployment.md) for full AWS ECS Fargate deployment guide.

## License

MIT
