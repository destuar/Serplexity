# Task Completion Workflow

## Quality Gates & Validation (8-Step Process)

### Before Making Changes
1. **Understand Requirements**: Clarify scope and acceptance criteria
2. **Explore Architecture**: Use semantic tools to understand existing patterns
3. **Plan Implementation**: Design changes that fit existing conventions

### During Development  
4. **Follow Conventions**: Match existing code style, import patterns, and architecture
5. **Write Tests**: Include appropriate unit/integration tests with ≥70% coverage
6. **Validate Security**: Ensure company isolation, input validation, and auth checks

### Before Completion
7. **Quality Checks**: Run all relevant linters and type checkers
8. **Integration Testing**: Verify changes work with existing system

## Commands to Run When Task is Completed

### Backend Changes
```bash
cd backend
npm run lint:all               # TypeScript + Python linting
npm run typecheck              # TypeScript type checking  
npm run build                  # Verify compilation
npm run test:quick             # Fast tests (~2 min)
```

### Frontend Changes  
```bash
cd frontend
npm run lint                   # ESLint check
npm run build                  # Production build verification
npm run test:run               # Vitest tests
```

### Database Schema Changes
```bash
cd backend
npm run generate               # Regenerate Prisma client
# For live/shared DBs: apply SQL patch via secrets wrapper (no migrations)
# For local dev: npm run migrate:dev (disposable DB only)
```

### Major Changes (Docker Validation)
```bash
# Mandatory after significant architectural changes
DOCKER_BUILDKIT=1 docker build --no-cache -f infra/docker/backend/Dockerfile.backend -t serplexity-backend:dev . | cat
DOCKER_BUILDKIT=1 docker build --no-cache -f infra/docker/frontend/Dockerfile.frontend -t serplexity-frontend:dev . | cat
```

### Pre-Deployment (Full Test Suite)
```bash
npm test                       # Run both backend and frontend tests
```

## Critical Database Policy
- **Live/Shared DBs**: DO NOT run Prisma migrations
- **Apply idempotent SQL patches** via AWS Secrets wrapper:
  ```bash
  ts-node src/scripts/run-with-secrets.ts npx prisma db execute --file /absolute/path/to.sql --schema prisma/schema.prisma
  ```
- **Local dev only**: You MAY use `npm run migrate:dev` on disposable databases

## Python Environment Management
- **Always use `./start.sh`** for backend development
- **Python virtual env**: `backend/venv/`
- **Requirements**: `backend/requirements.txt`
- **Health check**: `npm run ops:health` for PydanticAI agents

## Exit Criteria
- Build passes, tests pass, lints clean, types valid
- Behavior verified as needed
- Backend and frontend Docker images build successfully (for major changes)
- No TODO comments or incomplete implementations left behind