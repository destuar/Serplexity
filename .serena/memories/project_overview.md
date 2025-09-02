# Project Overview

**Serplexity** - Generative Engine Optimization (GEO) Platform

## Purpose
Serplexity is an agency-grade software platform that helps brands measure and grow visibility inside AI search engines. It's a multi-tenant SaaS with company-level data isolation and Stripe billing with freemium model.

## Business Domain
- **Brand visibility** in AI-generated search results
- **Multi-tenant SaaS** with company-level data isolation  
- **Stripe billing** with freemium model
- **GEO (Generative Engine Optimization)** - optimizing for AI search engines

## Tech Stack
### Backend
- **Language**: TypeScript (strict) on Node 20
- **Framework**: Express 4.19
- **Database**: PostgreSQL 15 + Prisma ORM
- **Queue System**: BullMQ on Redis 7
- **Authentication**: Passport (JWT + Google OAuth)
- **Billing**: Stripe integration
- **AI Integration**: Hybrid TypeScript/Python with PydanticAI 0.4.6
- **LLM Providers**: OpenAI, Anthropic, Gemini, Perplexity (multi-provider fanout)

### Frontend  
- **Framework**: React 18 + TypeScript (hooks-first)
- **Bundler**: Vite 5
- **Styling**: Tailwind CSS + Radix UI primitives
- **Design**: Glassmorphism aesthetic, tech-forward, space theme
- **State**: React Context + local reducer hooks (no Redux)
- **Charts**: Recharts + D3 utilities

### Infrastructure
- **Containers**: Docker 24, docker-compose for local dev
- **Production**: AWS ECS Fargate, RDS PostgreSQL Multi-AZ, Elasticache Redis
- **Storage**: S3 + Glacier for archival
- **Observability**: OpenTelemetry traces