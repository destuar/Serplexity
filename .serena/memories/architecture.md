# Architecture Overview

## Monorepo Structure
- **backend/**: Express + TypeScript API server with background job processing
- **frontend/**: React + Vite dashboard application with Tailwind CSS
- **infra/**: Docker configurations and deployment scripts

## Backend Architecture (Hybrid TypeScript/Python)
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
│   ├── agents/              # 9 specialized AI agents
│   ├── config/              # Python configuration and model setup
│   └── schemas.py           # Pydantic schemas for agent I/O
├── config/                   # Environment, database, Redis, tracing
├── utils/                    # Logger, cache, helpers
├── scripts/                  # Admin tools and maintenance scripts
└── __tests__/                # Jest tests (unit + integration)
```

## Key Architectural Principles
- **Controllers are thin** - business logic lives in services
- **Multi-tenant aware** - all models include `companyId`
- **Hybrid architecture**: Node.js handles API/web layer, Python handles AI agent processing
- **All BullMQ workers auto-register** when server starts
- **Prompts centralized** in `src/prompts/` for auditability
- **Python virtual environment required** for PydanticAI agents (managed via `./start.sh`)

## Frontend Architecture (React + Vite + Tailwind)
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

## Database Layer
- **Schema**: `backend/prisma/schema.prisma`
- **Migrations**: Auto-generated timestamp-based files
- **Client**: Generated via `npm run generate`
- **Multi-tenant**: All models include `companyId` for isolation

## Background Processing
- **Queue System**: BullMQ on Redis
- **Workers**: `*Worker.ts` files in `queues/` directory auto-register
- **Schedulers**: `*Scheduler.ts` files for cron-like jobs
- **Master scheduler**: Coordinates daily report generation

## AI Agent System (9 Specialized Agents)
Located in `backend/src/pydantic_agents/agents/`:
- **Answer Agent**: Comprehensive responses with citations
- **Search Agent**: Web searches and content extraction  
- **Sentiment Agent**: Sentiment analysis in mentions/content
- **Sentiment Summary Agent**: Aggregates sentiment analysis
- **Mention Agent**: Detects and classifies brand mentions
- **Research Agent**: Multi-source research coordination
- **Website Agent**: Website data enrichment and metadata
- **Question Agent**: Research question generation/processing
- **Fanout Agent**: Parallel processing across multiple AI models

## Path Aliases
- **Backend**: `@/` → `backend/src/`
- **Frontend**: `@/` → `frontend/src/`