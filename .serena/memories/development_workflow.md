# Development Workflow

## Local Development Setup
```bash
# 1. Install dependencies
npm install --prefix backend
npm install --prefix frontend

# 2. Set up environment files  
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start database and Redis (via Docker)
cd infra/docker && docker-compose up postgres redis -d

# 4. Database setup
# - Local dev only: cd backend && npm run migrate:dev
# - Live/shared DBs: apply SQL patch via secrets wrapper + npm run generate

# 5. Start development servers
cd backend && ./start.sh      # Terminal 1 (port 8001) - Python env setup
cd frontend && npm run dev    # Terminal 2 (port 3000)
```

## Development Principles
- **Think like a senior/"10x" engineer**: design-first, simplify, prove correctness
- **Work step-by-step**: validate each step (build/tests/lints) before moving on
- **Smallest viable change**: keep edits tight and focused
- **Complete implementations**: no TODOs, placeholders, or partial features

## Key Ports
- **Backend**: 8001 (via ./start.sh or npm run dev)
- **Frontend**: 3000 (proxies /api → backend)
- **PostgreSQL**: 5432 (local Docker)
- **Redis**: 6379 (local Docker)

## Authentication Flow
- JWT access/refresh tokens stored in localStorage
- Axios interceptor auto-refreshes via `/auth/refresh`
- Google OAuth integration via Passport.js
- Company-level tenant isolation enforced

## Critical Development Rules
1. **Python Environment**: Always use `./start.sh` for backend (ensures PydanticAI setup)
2. **Database Safety**: Never run migrations on shared/live DBs
3. **Queue Isolation**: Never import workers/schedulers from app code (self-register)
4. **Prompt Location**: All LLM prompts MUST live in `backend/src/prompts/`
5. **Multi-tenant**: All models include `companyId` for isolation

## Testing Strategy
- **Backend**: Jest with 70% coverage requirement
  - Unit tests: Services and utilities
  - Agent tests: PydanticAI agent validation  
  - Integration tests: End-to-end report flows
  - Production validation: Real API provider tests
- **Frontend**: Vitest + React Testing Library with 70% coverage requirement

## Queue System (BullMQ + Redis)
- Workers auto-register when server starts
- Environment-specific queue prefixes (dev-, prod-)
- Background jobs: report generation, data archival, scheduling
- Monitor with `npm run ops:monitor`