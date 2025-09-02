# Suggested Development Commands

## Backend Development
```bash
cd backend
./start.sh                     # ⭐ CRITICAL: Use for dev to ensure Python env setup
npm run dev                    # Alternative (use ./start.sh for Python deps)
npm run build                  # TypeScript compilation
npm run lint:all               # Both TypeScript and Python linting
npm run typecheck              # TypeScript type checking
npm run generate               # Generate Prisma client after schema changes

# Testing
npm test                       # ⭐ Full pre-deploy test suite (required before deploy)
npm run test:quick             # Fast unit tests + agent tests (~2 min)
npm run test:agents            # PydanticAI agent tests only
npm run test:integration       # Integration tests
npm run test:production        # Production validation with real APIs

# Python-specific
npm run python:check           # mypy + ruff + bandit checks
npm run python:lint            # Ruff linting with auto-fix
npm run python:format          # Ruff code formatting

# Database (CRITICAL: Read database change policy in CLAUDE.md)
npm run prisma:dev             # Prisma commands with AWS Secrets Manager
npm run studio:dev             # Prisma Studio with AWS secrets

# Operations
npm run ops:health             # Check PydanticAI agent health
npm run ops:monitor            # Monitor Redis queues
```

## Frontend Development
```bash
cd frontend
npm run dev                    # Start Vite dev server (port 3000)
npm run build                  # Production build
npm run lint                   # ESLint check
npm run test:run               # Run tests once
npm run test:coverage          # Generate coverage report
```

## Root-level Commands
```bash
npm test                       # Run both backend and frontend tests
npm run test:backend           # Backend tests only
npm run test:frontend          # Frontend tests only

# Docker validation (mandatory after major changes)
DOCKER_BUILDKIT=1 docker build --no-cache -f infra/docker/backend/Dockerfile.backend -t serplexity-backend:dev . | cat
DOCKER_BUILDKIT=1 docker build --no-cache -f infra/docker/frontend/Dockerfile.frontend -t serplexity-frontend:dev . | cat
```

## Single Test Commands
```bash
# Backend
cd backend && npx jest src/__tests__/auth.test.ts
cd backend && npx jest --testNamePattern="auth"
cd backend && npx jest src/__tests__/agents/ --testTimeout=60000

# Frontend
cd frontend && npx vitest src/__tests__/App.test.tsx
cd frontend && npx vitest --run --reporter=verbose --testNamePattern="AuthContext"
```