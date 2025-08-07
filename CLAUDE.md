# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Backend Development
```bash
cd backend
npm install                    # Install dependencies
./start.sh                     # Start development server with Python env setup (port 8001)
npm run dev                    # Alternative: direct start (use ./start.sh for Python deps)
npm run build                  # TypeScript compilation
npm run lint                   # ESLint check
npm run lint:fix               # ESLint with auto-fix
npm run typecheck              # TypeScript type checking without compilation
npm run generate               # Generate Prisma client after schema changes
npm run prisma:dev             # Prisma commands with AWS Secrets Manager integration
npm run migrate:dev            # Run Prisma database migrations (fetches AWS secrets)
npm run studio:dev             # Open Prisma Studio (fetches AWS secrets)
```

### Frontend Development
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Start Vite dev server (port 3000, proxies to backend)
npm run build                  # Production build
npm run lint                   # ESLint check
npm run preview                # Preview production build locally
```

### Testing Commands
```bash
# Backend Testing
cd backend
npm test                       # ⭐ Full pre-deploy test suite (required before deploy)
npm run test:quick             # Fast unit tests + agent tests (~2 min)
npm run test:watch             # Watch mode for development
npm run test:coverage          # Generate coverage report
npm run test:agents            # PydanticAI agent tests only
npm run test:integration       # Integration tests
npm run test:production        # Production validation with real APIs

# Frontend Testing
cd frontend
npm run test                   # Vitest tests
npm run test:run               # Run tests once
npm run test:coverage          # Generate coverage report
npm run test:ui                # Vitest UI mode
```

### Root-level Commands
```bash
npm test                       # Run both backend and frontend tests
npm run test:backend           # Backend tests only
npm run test:frontend          # Frontend tests only
npm run test:coverage          # Coverage for both
```

## Architecture Overview

### Monorepo Structure
- **backend/**: Express + TypeScript API server with background job processing
- **frontend/**: React + Vite dashboard application with Tailwind CSS
- **infra/**: Docker configurations and deployment scripts

### Backend Architecture (Express + Prisma + BullMQ + PydanticAI)
```
backend/src/
├── app.ts                    # Express app configuration (middleware, routes)
├── server.ts                 # HTTP server bootstrap + worker registration
├── controllers/              # Request/response handlers (thin layer)
├── services/                 # Business logic (unit test these)
├── routes/                   # Express route definitions
├── middleware/               # Auth, rate limiting, payment guards
├── queues/                   # BullMQ workers and schedulers
├── prompts/                  # LLM prompt templates (centralized)
├── pydantic_agents/          # Python PydanticAI agent implementations
│   ├── agents/              # Individual AI agents (answer, search, sentiment, etc.)
│   ├── config/              # Python configuration and model setup
│   └── schemas.py           # Pydantic schemas for agent I/O
├── config/                   # Environment, database, Redis, tracing
├── utils/                    # Logger, cache, helpers
├── scripts/                  # Admin tools and maintenance scripts
└── __tests__/                # Jest tests (unit + integration)
```

**Key Principles:**
- Controllers are thin - business logic lives in services
- All BullMQ workers auto-register when server starts
- Prompts are centralized in `src/prompts/` for auditability
- Multi-tenant: all models include `companyId`
- Hybrid TypeScript/Python architecture: Node.js handles API/web layer, Python handles AI agent processing
- Python virtual environment required for PydanticAI agents (managed via `./start.sh`)

### Frontend Architecture (React + Vite + Tailwind)
```
frontend/src/
├── components/               # Feature-based UI components
├── pages/                    # Route-level components
├── contexts/                 # React Context (Auth, Company, Dashboard)
├── hooks/                    # Reusable React hooks
├── lib/                      # API client, utilities
├── services/                 # API service layers
└── types/                    # TypeScript type definitions
```

### Database (PostgreSQL + Prisma)
- Schema: `backend/prisma/schema.prisma`
- Migrations: Auto-generated timestamp-based files
- Client: Generated via `npm run generate` in backend

### Background Processing (BullMQ + Redis)
- Queue prefix via `BULLMQ_QUEUE_PREFIX` environment variable
- Workers: `*Worker.ts` files in `queues/` directory
- Schedulers: `*Scheduler.ts` files for cron-like jobs
- Master scheduler coordinates daily report generation

## Development Workflow

### Local Development Setup
```bash
# 1. Install dependencies
npm install --prefix backend
npm install --prefix frontend

# 2. Set up environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start database and Redis (via Docker)
cd infra/docker && docker-compose up postgres redis -d

# 4. Run database migrations (with AWS Secrets Manager)
cd backend && npm run migrate:dev

# 5. Start development servers
cd backend && ./start.sh      # Terminal 1 (port 8001) - includes Python env setup
cd frontend && npm run dev    # Terminal 2 (port 3000)
```

### Pre-deployment Testing
**Always run before deploying:**
```bash
npm test  # Runs both backend and frontend test suites
```

### Code Quality Checks
```bash
# Backend
cd backend
npm run lint && npm run typecheck

# Frontend
cd frontend
npm run lint && npm run build
```

## Important Technical Details

### Authentication & Authorization
- JWT-based auth with access/refresh tokens
- Google OAuth integration via Passport.js
- Company-level tenant isolation
- Payment-gated features via middleware guards

### Database Connection Management
- **AWS Secrets Manager Integration**: Database credentials stored securely in AWS
- **Automatic Secret Retrieval**: `scripts/run-with-secrets.ts` fetches DB credentials
- **Prisma Commands**: All Prisma operations use `npm run prisma:dev` for secret management
- **Legacy Support**: Falls back to `DATABASE_URL` environment variable if not using AWS secrets

### LLM Integration
- Multi-provider setup: OpenAI, Anthropic, Gemini, Perplexity
- Fanout system queries multiple models simultaneously
- Prompt templates centralized in `backend/src/prompts/`
- Resilient service with failover and retry logic
- **Python PydanticAI Agents**: Specialized AI agents for different tasks
  - Answer Agent: Generates comprehensive responses with citations
  - Search Agent: Performs web searches and content extraction
  - Sentiment Agent: Analyzes sentiment in mentions and content
  - Mention Agent: Detects and classifies brand mentions
  - Research Agent: Conducts research across multiple sources

### Queue System
- BullMQ on Redis for background job processing
- Report generation, data archival, scheduling
- All workers auto-start when server boots
- Environment-specific queue prefixes (dev-, prod-, etc.)

### Data Archival
- AWS Glacier integration for long-term storage
- Automatic cleanup of old fanout responses
- S3 for file uploads and temporary storage

### Testing Strategy
- **Backend**: Jest with 70% coverage requirement
  - Unit tests: Services and utilities
  - Agent tests: PydanticAI agent validation (`src/__tests__/agents/`)
  - Integration tests: End-to-end report generation flows
  - Production validation: Real API provider tests (separate config)
- **Frontend**: Vitest + React Testing Library with 70% coverage requirement
- **Test Organization**:
  - `backend/src/__tests__/agents/` - PydanticAI agent tests
  - `backend/src/__tests__/integration/` - Integration test flows
  - `backend/src/__tests__/production-validation.test.ts` - Real API tests
  - `frontend/src/__tests__/` - Frontend component tests

## Path Aliases
- **Backend**: `@/` → `backend/src/`
- **Frontend**: `@/` → `frontend/src/`

## Environment Configuration

### Backend Required Variables
```bash
NODE_ENV=development
PORT=8001

# Database - Legacy (optional when using AWS Secrets Manager)
DATABASE_URL=postgresql://...          # Optional if using AWS Secrets Manager

# AWS Secrets Manager Configuration
SECRETS_PROVIDER=aws                   # or "environment" for local dev
DATABASE_SECRET_NAME=your-db-secret    # Name of AWS secret containing DB credentials
USE_AWS_SECRETS=true                   # Legacy flag for backward compatibility

# AWS Configuration
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Email Alerting (Optional - for system failure notifications)
SMTP_HOST=smtp.gmail.com               # SMTP server hostname
SMTP_PORT=587                          # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@gmail.com         # SMTP username
SMTP_PASSWORD=your-app-password        # SMTP password or app password
SMTP_FROM_EMAIL=alerts@yourcompany.com # From email address for alerts

# Other required variables
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
CORS_ORIGIN=http://localhost:3000
STRIPE_SECRET_KEY=sk_...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...
# ... see .env.example for complete list
```

### Frontend Required Variables
```bash
VITE_API_URL=http://localhost:8001/api
```

## Deployment Notes

### Docker Setup
```bash
cd infra/docker
./docker-rebuild.sh     # Build images
docker-compose up -d    # Start all services
```

### Production Considerations
- Use read replicas for database scaling
- Configure Redis TLS for cloud deployment
- Set up proper CORS origins
- Enable OpenTelemetry tracing
- Configure AWS credentials for S3/Glacier

## Common Operational Tasks

### Database Operations
```bash
cd backend
npm run studio:dev                    # Open Prisma Studio (fetches AWS secrets)
npm run migrate:dev -- --name=add_field  # Create new migration (fetches AWS secrets)
npm run generate                      # Regenerate Prisma client
npm run prisma:dev -- migrate reset   # Reset database (fetches AWS secrets)
npm run prisma:dev -- db push         # Push schema changes (fetches AWS secrets)
```

### Queue Monitoring
```bash
cd backend
npm run ops:monitor    # Monitor Redis queues
npm run ops:health     # Check PydanticAI agent health
npm run ops:repair     # Repair failed reports
npm run queue-report   # Queue a report generation job
```

### Running Admin Scripts
```bash
cd backend
ts-node src/scripts/script-name.ts
```

## Key Files to Know

### Configuration Files
- `backend/src/config/env.ts` - Environment variable validation
- `backend/src/app.ts` - Express app setup
- `backend/src/server.ts` - Server bootstrap
- `backend/start.sh` - Development server startup with Python environment
- `backend/scripts/run-with-secrets.ts` - AWS Secrets Manager integration for Prisma
- `backend/src/services/secretsProvider.ts` - Secrets management service
- `backend/prisma/schema.prisma` - Database schema
- `frontend/vite.config.js` - Frontend build configuration

### Important Services
- `backend/src/services/pydanticLlmService.ts` - LLM integration
- `backend/src/services/dashboardService.ts` - Dashboard data
- `backend/src/services/metricsService.ts` - Analytics calculations
- `backend/src/queues/reportWorker.ts` - Background report generation

## Security & Best Practices

- Never commit API keys or secrets
- All routes require authentication except auth endpoints
- Company-level data isolation enforced at database level
- Rate limiting on all public endpoints
- Helmet.js for security headers
- Input validation with Zod schemas

## Troubleshooting

### Common Issues
- **Port conflicts**: Backend uses 8001, frontend uses 3000
- **Database migrations**: Always run `npm run migrate:dev` after schema changes
- **Prisma client**: Run `npm run generate` after schema updates
- **AWS Secrets**: Ensure `DATABASE_SECRET_NAME` and AWS credentials are set
- **Python environment**: Use `./start.sh` to ensure PydanticAI dependencies are available
  - Python virtual env located at `backend/venv/`
  - Requirements file: `backend/requirements.txt`
- **Queue issues**: Check Redis connection and BULLMQ_QUEUE_PREFIX
- **Build failures**: Run `npm run typecheck` to catch TypeScript errors
- **PydanticAI agent failures**: Run `npm run ops:health` to check agent status

### Debug Commands
```bash
# Check service health
curl http://localhost:8001/api/health

# Monitor queue status
cd backend && npm run ops:monitor

# Check recent logs
docker-compose logs backend
```

## Single Test Commands
```bash
# Run a single test file
cd backend && npx jest src/__tests__/auth.test.ts
cd frontend && npx vitest src/__tests__/App.test.tsx

# Run tests matching a pattern
cd backend && npx jest --testNamePattern="auth"
cd frontend && npx vitest --run --reporter=verbose --testNamePattern="AuthContext"

# Run specific test suites
cd backend && npx jest src/__tests__/agents/ --testTimeout=60000  # Agent tests only
cd backend && npx jest src/__tests__/integration/ --testTimeout=120000  # Integration tests only
```

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

## Development Best Practices from Cursor Rules

### Code Quality Principles
- Write clean, simple, readable code with clear reasoning
- Implement features in the simplest possible way possible
- Keep files small and focused (<200 lines)
- Test after every meaningful change  
- Use clear, consistent naming conventions
- ALWAYS ask follow-up questions to clarify requirements before coding
- Write modular, well-documented code with explanatory comments
- One abstraction layer per file - controllers call services, services call utils/db

### Error Handling Best Practices
- DO NOT JUMP TO CONCLUSIONS when debugging - consider multiple possible causes
- Make only minimal necessary changes when fixing issues
- Use structured logging with appropriate log levels (debug/info/warn/error)
- Implement proper error boundaries in React components
- Prefer async/await + try/catch patterns over promises

### Project-Specific Conventions
- All prompts MUST live in `backend/src/prompts/` for auditability
- Use explicit TypeScript types everywhere - `any` is banned
- Include LOTS of explanatory comments - document the "why" not just the "what"
- Follow feature-based directory structure in both backend and frontend
- All new code must include unit tests and pass lint checks

### File Organization Rules
- Backend services: Pure, reusable business logic (unit test these directly)
- Controllers: Thin request/response orchestration (keep business-logic free)
- Queues: Import registers worker (side-effect) - never import from here in regular code
- Frontend: Feature-based structure for components/pages/contexts/hooks

## Additional Important Guidelines

### Development Best Practices
- Follow the hybrid TypeScript/Python architecture pattern
- Controllers should be thin - business logic belongs in services
- All BullMQ workers auto-register when server starts
- Use centralized prompt templates in `src/prompts/` for auditability
- Maintain multi-tenant patterns with `companyId` in all models
- Always use `./start.sh` for backend development to ensure Python environment setup

### Code Quality Standards
- Backend: Jest with 70% coverage requirement
- Frontend: Vitest + React Testing Library with 70% coverage requirement
- Use ESLint and TypeScript strict mode
- Follow existing import patterns and project conventions
- Input validation should use Zod schemas

### Python Environment Management
- Python virtual environment is located at `backend/venv/`
- Requirements managed via `backend/requirements.txt`
- PydanticAI agents require proper Python environment setup
- Use `npm run ops:health` to check agent status

### Security Requirements
- JWT-based authentication with access/refresh tokens
- Company-level data isolation enforced at database level
- Rate limiting on all public endpoints
- Helmet.js for security headers
- Never commit API keys or secrets
- AWS Secrets Manager integration for database credentials

### Testing Requirements
- Always run `npm test` before deploying (covers both backend and frontend)
- Use `npm run test:quick` for fast development testing (~2 min)
- Production validation tests require real API keys
- Agent tests validate all 9 PydanticAI agents
- Integration tests cover end-to-end report generation flows

### AI Agent Architecture
The system uses 9 specialized PydanticAI agents in `backend/src/pydantic_agents/agents/`:
- **Answer Agent** (`answer_agent.py`): Generates comprehensive responses with citations
- **Search Agent** (`search_agent.py`): Performs web searches and content extraction
- **Sentiment Agent** (`sentiment_agent.py`): Analyzes sentiment in mentions and content
- **Sentiment Summary Agent** (`sentiment_summary_agent.py`): Aggregates sentiment analysis
- **Mention Agent** (`mention_agent.py`): Detects and classifies brand mentions
- **Research Agent** (`research_agent.py`): Conducts research across multiple sources
- **Website Agent** (`website_agent.py`): Enriches website data and metadata
- **Question Agent** (`question_agent.py`): Generates and processes research questions
- **Fanout Agent** (`fanout_agent.py`): Coordinates parallel processing across multiple AI models

**Python Agent Integration**:
- PydanticAI 0.4.6 with multi-provider support (OpenAI, Anthropic, Gemini, Groq)
- Structured output validation using Pydantic schemas
- Logfire integration for observability and debugging
- FastAPI service wrapper for Node.js integration
- Health monitoring via `npm run ops:health`

### Project Business Domain
This is **Serplexity**, a Generative Engine Optimization (GEO) platform that helps brands measure and grow visibility inside AI search engines. Key business concepts:
- **PAWC**: Position-Adjusted Word Share metric
- **AIR**: Answer Inclusion Rate metric  
- **Brand visibility** in AI-generated search results
- **Multi-tenant SaaS** with company-level data isolation
- **Stripe billing** with freemium model