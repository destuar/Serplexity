# Code Style and Conventions

## Architecture Principles
- **Hybrid TypeScript/Python**: Node.js handles API/web layer, Python handles AI agent processing
- **Thin controllers**: Business logic lives in services, controllers handle request/response only
- **Multi-tenant**: All models include `companyId` for company-level data isolation
- **Feature-based organization**: Group by domain/feature, not file type
- **Small files**: Keep files ≤200 LOC, extract helpers early

## TypeScript Standards
- **Strict mode**: tsc --strict, no `any` types allowed
- **Explicit types**: Use explicit TypeScript types everywhere
- **Path aliases**: `@/` → `backend/src/` or `frontend/src/`
- **Import organization**: Follow existing patterns
- **Validation**: Use Zod schemas for input validation

## Python Standards (PydanticAI Agents)
- **Type hints**: Full type annotations required
- **Validation**: Pydantic schemas for all agent I/O
- **Environment**: Virtual environment at `backend/venv/`
- **Linting**: mypy --strict, ruff check --select ALL, bandit -r
- **Agent location**: All agents in `backend/src/pydantic_agents/agents/`

## File Organization Rules
- **Backend services**: Pure, reusable business logic (unit test these)
- **Controllers**: Thin request/response orchestration
- **Queues**: Self-registering workers, never import from app code
- **Prompts**: Centralized in `backend/src/prompts/` for auditability
- **Frontend**: Feature-based structure for components/pages/contexts/hooks

## Quality Standards
- **Coverage**: ≥70% for both backend (Jest) and frontend (Vitest)
- **Testing**: Unit tests for services, integration tests for flows
- **Linting**: ESLint + TypeScript strict + Python mypy/ruff/bandit
- **Error handling**: Structured logging, proper error boundaries
- **Security**: JWT auth, rate limiting, input validation, no committed secrets