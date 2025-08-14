const globals = require("globals");
const tseslint = require("typescript-eslint");

module.exports = tseslint.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "*.js",
      "jest.config.js",
      "coverage/",
      "prisma/migrations/",
      "venv/",
      "src/__tests__/**",
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        project: "./tsconfig.json",
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Power of Ten Rule #9: No "any" type obscurity
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-require-imports": "error",

      // Power of Ten Rule #1: Keep control-flow trivial
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",

      // Power of Ten Rule #2: Predictable loop bounds
      "no-unmodified-loop-condition": "error",
      "no-unreachable-loop": "error",

      // Power of Ten Rule #4: Small units (~60 LOC)
      "max-lines-per-function": [
        "error",
        { max: 60, skipBlankLines: true, skipComments: true },
      ],
      "max-statements": ["error", 20],
      complexity: ["error", 10],

      // Power of Ten Rule #6: Narrowest data scope
      "prefer-const": "error",
      "no-var": "error",
      "block-scoped-var": "error",

      // Power of Ten Rule #7: Handle returns & validate inputs
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "no-promise-executor-return": "error",

      // General quality rules
      "no-debugger": "error",
      "no-console": "warn", // Allow console for backend logging
      "max-len": ["warn", { code: 120, ignoreUrls: true, ignoreStrings: true }],
    },
  },
  // Pragmatic overrides for operationally heavy layers
  {
    files: [
      "src/controllers/**/*.ts",
      "src/routes/**/*.ts",
      "src/queues/**/*.ts",
      "src/services/**/*.ts",
      "src/middleware/**/*.ts",
      "src/scripts/**/*.ts",
      "src/utils/**/*.ts",
      "src/config/**/*.ts",
    ],
    rules: {
      // Reduce noise in heavy operational paths to focus on correctness
      "max-lines-per-function": "off",
      "max-statements": "off",
      complexity: "off",
      "max-len": "off",
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-floating-promises": "off",
      "no-promise-executor-return": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Scripts are operational; allow non-blocking patterns
  {
    files: ["src/scripts/**/*.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "no-console": "off",
      "max-len": "off",
    },
  },
  // Server bootstrap: event-driven promises are intentionally not awaited
  {
    files: ["src/server.ts"],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "no-promise-executor-return": "off",
      "max-statements": "off",
      "max-len": "off",
      "no-console": "off",
    },
  },
  // Express app composition
  {
    files: ["src/app.ts"],
    rules: {
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-len": "off",
    },
  }
);
