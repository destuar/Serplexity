# Tech Stack Overview

## Backend (TypeScript + Python Hybrid)
- **Runtime:** Node.js 20 + Python 3.11 (hybrid architecture)
- **Framework:** Express 4.19 with TypeScript (strict mode)
- **Database:** PostgreSQL 15 with Prisma ORM
- **Queue System:** BullMQ on Redis 7
- **AI Integration:** PydanticAI 0.4.6 with multi-provider support (OpenAI, Anthropic, Gemini, Groq)
- **Authentication:** JWT with Passport.js (Google OAuth)
- **Payment:** Stripe integration
- **Storage:** AWS S3 + Glacier for archival
- **Monitoring:** OpenTelemetry + Logfire

## Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite 7
- **Styling:** Tailwind CSS 3 + Radix UI primitives
- **Charts:** Recharts + D3 utilities
- **State Management:** React Context + hooks (no Redux)
- **Testing:** Vitest + React Testing Library

## Infrastructure
- **Containerization:** Docker + docker-compose
- **Development:** Local development with docker-compose
- **Production:** AWS ECS Fargate + RDS + ElastiCache
- **CI/CD:** GitHub Actions