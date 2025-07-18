# Serplexity Backend Testing Guide

## Quick Start - Pre-Deploy Testing

**Before deploying, always run:**
```bash
npm test
```

This runs our complete pre-deployment test suite: unit tests, integration tests, and production validation.

## Test Commands

### Essential Commands (Use These)

```bash
npm test                 # ⭐ Full pre-deploy test suite (required before deploy)
npm run test:quick       # 🚀 Fast unit tests + agent tests (~2 min)
npm run test:full        # 📊 Complete tests + coverage report

npm run test:watch       # 👀 Watch mode for development
npm run test:coverage    # 📈 Generate coverage report
```

### Individual Test Suites

```bash
npm run test:unit        # Unit tests (auth, company, payment, etc.)
npm run test:integration # Integration tests (report flow, agents)
npm run test:production  # Production validation with real APIs
npm run test:agents      # PydanticAI agent tests only
```

### Operations Commands

```bash
npm run ops:health       # Check PydanticAI agent health
npm run ops:monitor      # Monitor Redis queues
npm run ops:repair       # Repair failed reports
```

## Test Structure

```
src/__tests__/
├── agents/                    # PydanticAI agent tests
├── integration/               # System integration tests
├── production-validation.test.ts   # Production API validation
├── typescript-integration.test.ts  # Service integration tests
├── app.test.ts               # Core app tests
├── auth.test.ts              # Authentication tests
├── company.test.ts           # Company management tests
├── payment.test.ts           # Payment system tests
├── user.test.ts              # User management tests
├── report.test.ts            # Report generation tests
└── config/                   # Configuration tests
```

## CI/CD Integration

### Pre-commit Hook
Add to your `.git/hooks/pre-commit`:
```bash
#!/bin/sh
npm run test:quick
```

### GitHub Actions
```yaml
- name: Run Tests
  run: npm test
```

## Test Environment Setup

Required environment variables:
```bash
NODE_ENV=test
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GEMINI_API_KEY=your_key
```

## What Each Test Suite Validates

- **Unit Tests**: Core business logic, controllers, services
- **Integration Tests**: End-to-end report generation, agent interactions  
- **Production Tests**: Real API calls, service integration, client safety validation
- **Agent Tests**: All 6 PydanticAI agents (sentiment, fanout, Q&A, optimization, summary, enrichment)

## Test Guidelines

1. **Always run `npm test` before deploying**
2. **Use `npm run test:quick` during development** 
3. **Production tests require real API keys**
4. **Keep tests focused and fast**
5. **Mock external dependencies in unit tests**

## Archived Files

Old scripts and tests are in `archive/` - these were development utilities that are no longer needed for regular testing.