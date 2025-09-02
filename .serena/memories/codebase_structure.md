# Codebase Structure Overview

## Monorepo Layout
```
Serplexity/
├── backend/                   # Express + TypeScript API server
│   ├── src/
│   │   ├── controllers/       # Thin request/response handlers
│   │   ├── services/          # Business logic (unit test these)
│   │   ├── routes/            # Express route definitions
│   │   ├── middleware/        # Auth, rate limiting, payment guards
│   │   ├── queues/            # BullMQ workers and schedulers
│   │   ├── prompts/           # LLM prompt templates (centralized)
│   │   ├── pydantic_agents/   # Python PydanticAI agent implementations
│   │   │   ├── agents/        # 9 specialized AI agents
│   │   │   ├── config/        # Python configuration and model setup
│   │   │   └── schemas.py     # Pydantic schemas for agent I/O
│   │   ├── config/            # Environment, database, Redis, tracing
│   │   ├── utils/             # Logger, cache, helpers
│   │   └── scripts/           # Admin tools and maintenance scripts
│   ├── prisma/                # Database schema and migrations
│   └── __tests__/             # Jest tests (unit + integration + agents)
│
├── frontend/                  # React + Vite dashboard
│   ├── src/
│   │   ├── components/        # Feature-based UI components
│   │   ├── pages/             # Route-level components
│   │   ├── contexts/          # React Context (Auth, Company, Dashboard)
│   │   ├── hooks/             # Reusable React hooks
│   │   ├── lib/               # API client, utilities
│   │   ├── services/          # API service layers
│   │   └── types/             # TypeScript type definitions
│   └── __tests__/             # Vitest + React Testing Library
│
├── infra/                     # Docker configurations and deployment
└── scripts/                   # Root-level utility scripts
```

## Key Architectural Patterns
- **Hybrid Architecture**: TypeScript for API/web, Python for AI processing
- **Multi-tenant**: All data isolated by `companyId`
- **Queue-based**: Background processing via BullMQ/Redis
- **Microservice-like**: Clear separation between web layer and AI agents
- **Event-driven**: Report generation, archival, and notifications via queues