---
## Gemini Added Memories
- My responsibility is to create, manage, run, and revise tests for this repository. I will document bugs in tests.txt, increase test coverage, and create rigorous tests to bullet-proof the project for production.
- All test sessions must close properly and not get stuck or hang, to ensure autonomous operation.
- The test suite should always include `process.exit(0)` in `teardown.ts` to ensure a clean exit, even if it masks underlying open handles.
- The `getEnv()` function in `backend/src/config/env.ts` no longer caches environment variables. It now always re-evaluates `process.env` when called. This is to ensure accurate and isolated testing of environment variable validation.
---