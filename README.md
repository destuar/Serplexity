# Serplexity – Generative Engine Optimization Platform

> *The first agency-grade software platform purpose-built for the era of AI Search– enabling brands to measure and grow visibility inside AI answers.*

---

## Table of Contents
1. [Monorepo Layout](#monorepo-layout)
2. [Tech Stack](#tech-stack)
3. [Backend Service](#backend-service)
4. [Frontend Web App](#frontend-web-app)
5. [Database & Migrations](#database--migrations)
6. [Infrastructure](#infrastructure)
7. [Development Workflow](#development-workflow)
8. [Environment Variables](#environment-variables)
9. [Testing](#testing)
10. [CI / CD](#ci--cd)
11. [Scripts & CLI](#scripts--cli)
12. [Metrics Formulae](#metrics-formulae)
13. [Contributing](#contributing)

---

## Monorepo Layout
```
Serplexity/
├─ backend/               # Express + Prisma API (Node 20)
│  ├─ src/               # Application source
│  │  ├─ controllers/    # Route handlers (REST-first)
│  │  ├─ routes/         # Express Routers – versioned under /api
│  │  ├─ middleware/     # Auth, guards, error handling
│  │  ├─ queues/         # BullMQ workers & schedulers (Redis)
│  │  ├─ services/       # Domain & integration services (OpenAI, Stripe, …)
│  │  ├─ prompts/        # LLM prompt templates (imported via @/prompts)
│  │  ├─ config/         # env, db, tracing, passport, redis
│  │  ├─ scripts/        # One-off backfills & admin tooling (ts-node)
│  │  ├─ app.ts          # Express app composition (no listener)
│  │  ├─ server.ts       # HTTP server bootstrap (port binding)
│  │  └─ …
│  ├─ prisma/            # Prisma schema + generated client + migrations
│  └─ __tests__/         # Jest integration & unit tests
│
├─ frontend/              # React 18 + Vite + Tailwind dashboard
│  ├─ src/
│  │  ├─ components/     # Feature-oriented, collocated styles
│  │  ├─ pages/          # Route-level UI (react-router-dom v6)
│  │  ├─ layout/         # Navbar, Header, shell components
│  │  ├─ contexts/       # React Context stores (Auth, Company, Dashboard)
│  │  ├─ lib/            # API client, logo service, formatters
│  │  ├─ hooks/          # Shared hooks (useAuth, useCompany, …)
│  │  └─ ui/             # Generic Radix-powered UI primitives
│  └─ __tests__/         # Vitest + React Testing Library
│
├─ infra/                 # Docker, nginx, docker-compose, CI helpers
├─ docs/                  # Architecture decision records, plans, diagrams
└─ README.md              # This file
```

---

## Tech Stack
### Backend
- **Language:** TypeScript (strict) running on Node 20
- **Framework:** Express 4.19 (current stable)
- **ORM:** Prisma – PostgreSQL 15
- **Queue / Jobs:** BullMQ on Redis 7 (dedicated connection pool)
- **Authentication:** Passport (JWT + Google OAuth) – access/refresh tokens
- **Billing:** Stripe (monthly / annual prices, webhooks handled via `paymentController`)
- **LLM Providers:** OpenAI, Anthropic, Gemini, Perplexity (swappable adapters)
- **Observability:** Lightweight console-based logger (`utils/logger.ts`) ➜ OpenTelemetry traces ➜ OTLP exporter

### Frontend
- **Language:** TypeScript + React 18 (hooks-first)
- **Bundler:** Vite 5 (HMR in <50 ms)
- **Styling:** Tailwind CSS ^3 with Radix UI primitives, glassmorphism aesthetic for on-brand futuristic UI [[memory:2751602]]
- **Charts:** Recharts + D3 utilities
- **State:** React Context + local reducer hooks (no Redux)

### Tooling
- **Lint:** eslint (vite plugin) + prettier enforced in CI
- **Tests:** Jest 29 (backend) & Vitest v1 (frontend)
- **Containers:** Docker 24, docker-compose for local dev; ECS Fargate in prod

---

## Backend Service
### Runtime entrypoints
| File | Description |
|------|-------------|
| `src/server.ts` | Creates HTTP server, attaches Express app, starts listening on `env.PORT`. |
| `src/app.ts` | Pure Express composition (routes, middleware, error handler). Importable into tests. |
| `src/queues/*` | Long-running BullMQ workers. Start with `npm run worker:<name>` or via `masterScheduler`. |

### Key Concepts
1. **Multi-Tenant aware** – all models include `companyId`; middleware derives tenant from JWT.
2. **Stripe metered-billing** – hooks update `company.subscriptionStatus` on webhooks.
3. **Fan-out pipeline** – ingest → queue → streaming DB writer (see `queues/streaming-db-writer.ts`).
4. **LLM prompts** – centralised in `src/prompts/` (import alias `@/prompts`).
5. **Archival** – Glacier vault + Glacier SELECT via `archiveWorker.ts`.

### Core Endpoints (excerpt)
```
POST   /api/auth/login            – password or Google OAuth token
POST   /api/auth/refresh          – issue new access token
GET    /api/dashboard/overview    – high-level metrics for current company
POST   /api/payments/checkout     – create Stripe checkout session
POST   /api/reports/generate      – trigger async SERP report (queues)
```
> For full contract inspect the `routes/` directory or the OpenAPI spec generated at runtime (`/api/docs` when `NODE_ENV !== 'production'`).

### Middleware Pipeline
```
req ▶ logger ▶ cors ▶ json-limit ▶ passport-jwt ▶ authGuard ▶ routes ▶ errorHandler
```
- **Custom guards** (`paymentGuard`, `CompanyGuard`) gate premium features.

---

## Frontend Web App
- Bootstrapped with `create-vite`. Served by nginx in production; `vite dev` in local.
- **Routing:** `react-router-dom@6` with protected routes (`ProtectedRoute.tsx`).
- **Auth Flow:** JWT stored in `localStorage`; axios interceptor auto-refreshes via `/auth/refresh`.
- **Design System:** Tailwind + Radix ensures accessible components; custom glassmorphism tokens in `tailwind.config.js`.
- **API Layer:** `src/lib/apiClient.ts` wraps axios and centralises error / token logic.
- **Testing:** Vitest + JSDOM, see `frontend/src/__tests__/`.

---

## Database & Migrations
- PostgreSQL 15 managed via **Prisma**.
- Schema lives in `backend/prisma/schema.prisma`.
- Every migration is timestamp-prefixed and auto-generated via `prisma migrate dev`.
- Naming convention: `<yyyymmddHHMMSS>_<slug>/migration.sql`.
- Seed / backfill scripts in `backend/src/scripts/` – executed with `ts-node`.

> For an entity-relationship diagram run `npx prisma erd` (requires [prisma-erd-generator](https://github.com/imranbarbhuiya/prisma-erd-generator)).

---

## Infrastructure
| Layer | Dev | Prod |
|-------|-----|------|
| Containers | `docker-compose up` – Postgres, Redis, backend, frontend | AWS ECS Fargate tasks (backend & workers), RDS PostgreSQL Multi-AZ, Elasticache Redis |
| Storage | Local volume | S3 + Glacier |
| CDN | – | CloudFront (static frontend) |

### Local Compose
```
cd infra/docker
./docker-rebuild.sh      # build backend & frontend images
./docker-compose.yml     # brings up pg@localhost:5432, redis@6379, backend@8000, frontend@5173
```

---

## Development Workflow
1. **Clone & Install**
   ```bash
   git clone https://github.com/destuar/serplexity.git
   cd serplexity
   npm install --prefix backend   # install backend dependencies
   npm install --prefix frontend  # install frontend dependencies
   ```
2. **Environment** – copy `.env.example` into `backend/.env` & `.env` in `frontend/`.
3. **Database** – ensure Postgres is running (`docker-compose up db`). Then:
   ```bash
   cd backend
   npx prisma migrate dev --name init
   npm run dev
   ```
4. **Frontend**
   ```bash
   cd frontend && npm run dev -- --open
   ```
5. **Tests** – run all with `npm run test:backend && npm run test:frontend`.

### Useful Commands
| Command | Scope | Purpose |
|---------|-------|---------|
| `npm run dev` | backend | ts-node-dev with auto reload + source-map support |
| `npm run worker:archive`| backend | start Glacier archiver worker |
| `npm run lint` | any | eslint + prettier check |
| `npm run test:watch` | backend | Jest watch mode |
| `npm run generate` | backend | Regenerate Prisma client |
| `npm run vitest` | frontend | Vitest in watch mode |

---

## Environment Variables
### Backend (`backend/.env`)
| Var | Description |
|-----|-------------|
| `NODE_ENV` | `development` \| `production` \| `test` |
| `PORT` | HTTP port (default `8000`) |
| `DATABASE_URL` | Postgres connection URI |
| `READ_REPLICA_URL` | Optional read replica URI |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Signing keys |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials |
| `GOOGLE_CALLBACK_URL` | OAuth redirect |
| `FRONTEND_URL` | e.g. `http://localhost:5173` |
| `CORS_ORIGIN` | Allowed origin(s) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing |
| `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_ANNUAL_PRICE_ID` | Price lookup |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | S3 / Glacier |
| `GLACIER_VAULT_NAME` / `GLACIER_ACCOUNT_ID` | Archive target |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `PERPLEXITY_API_KEY` | LLM access |

### Frontend (`frontend/.env`)
| Var | Description |
|-----|-------------|
| `VITE_API_URL` | Base URL of backend (e.g. `http://localhost:8000/api`) |

---

## Testing
- **Backend** – Jest + supertest. Global setup spins up an in-memory Postgres (via `pg-mem`) & Redis mocks. Coverage reports generated to `backend/coverage/`.
- **Frontend** – Vitest + React Testing Library; see sample tests in `frontend/src/__tests__/`.

Run both suites:
```bash
npm test                  # root ─> runs workspaces
```

---

## CI / CD
GitHub Actions workflow (`.github/workflows/ci.yml`):
1. Install deps with npm cache (or pnpm if preferred).
2. Static analysis (`npm run lint`).
3. Run unit & integration tests.
4. Build Docker images and push to `ghcr.io/serplexityai`.
5. Trigger deploy on ECS via `aws-deploy` action (prod only on `main`).

---

## Scripts & CLI
All scripts live in `backend/src/scripts/` and are executed with ts-node:
```
# backfill competitor website requirement
npm run ts-node --prefix backend src/scripts/backfill-competitor-change.ts
```
Admin-friendly aliases are defined in `backend/package.json > scripts`.

---

---

## Contributing
1. Fork & clone. Create a feature branch (`feat/<ticket>`).
2. Follow **Conventional Commits** (`fix:`, `feat:`, `chore:` …).
3. Run `npm run lint && npm test`. Ensure ≥90 % coverage.
4. Submit a PR; the bot enforces status checks & auto-labels.

---

© 2025 Serplexity. All rights reserved.