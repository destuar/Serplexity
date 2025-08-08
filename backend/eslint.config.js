const globals = require('globals');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  { 
    ignores: [
      'dist/',
      'node_modules/',
      '*.js',
      'jest.config.js',
      'coverage/',
      'prisma/migrations/',
      'venv/',
      'src/__tests__/**',
    ] 
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }
      ],
      // Power of Ten Rule #9: No "any" type obscurity
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      
      // Power of Ten Rule #1: Keep control-flow trivial
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      
      // Power of Ten Rule #2: Predictable loop bounds
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      
      // Power of Ten Rule #4: Small units (~60 LOC)
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 20],
      'complexity': ['error', 10],
      
      // Power of Ten Rule #6: Narrowest data scope
      'prefer-const': 'error',
      'no-var': 'error',
      'block-scoped-var': 'error',
      
      // Power of Ten Rule #7: Handle returns & validate inputs
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'no-promise-executor-return': 'error',
      
      // General quality rules
      'no-debugger': 'error',
      'no-console': 'warn', // Allow console for backend logging
      'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    },
  },
);