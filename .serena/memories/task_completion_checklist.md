# Task Completion Checklist

## Pre-Completion Validation (MANDATORY)

### Quality Gates
1. **Build verification**: 
   - Backend: `npm run build && npm run typecheck`
   - Frontend: `npm run build`

2. **Linting validation**:
   - Backend: `npm run lint:all` (includes TypeScript + Python)
   - Frontend: `npm run lint`

3. **Test execution**:
   - Quick validation: `npm run test:quick` (~2 min)
   - Full validation: `npm test` (both backend + frontend)
   - Coverage check: Ensure ≥70% coverage maintained

### Security & Safety Checks
- **No secrets committed**: Never commit API keys or secrets
- **Database safety**: Follow database change policy (no migrations on live/shared DBs)
- **Multi-tenant boundaries**: Ensure `companyId` isolation maintained
- **Input validation**: Zod schemas for all inputs

### Architecture Compliance
- **Controller thinness**: Business logic in services, not controllers
- **File size**: Keep files ≤200 LOC
- **Type safety**: No `any` types, explicit TypeScript everywhere
- **Import organization**: Follow existing patterns

## Docker Build Validation (After Major Changes)
```bash
# Backend validation
DOCKER_BUILDKIT=1 docker build --no-cache -f infra/docker/backend/Dockerfile.backend -t serplexity-backend:dev . | cat

# Frontend validation  
DOCKER_BUILDKIT=1 docker build --no-cache -f infra/docker/frontend/Dockerfile.frontend -t serplexity-frontend:dev . | cat
```

## Python Environment Validation
- **Agent health**: `npm run ops:health` to check PydanticAI agent status
- **Python checks**: `npm run python:check` for mypy + ruff + bandit validation

## Post-Completion Actions
- **Clean workspace**: Remove any temporary files or debugging artifacts
- **Update documentation**: If architectural changes, update relevant docs
- **Memory cleanup**: Remove obsolete memory files if any created during task