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
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'error', // Strict: no any types allowed
      '@typescript-eslint/no-require-imports': 'error',
      
      // Critical rules
      'no-debugger': 'error',
      'prefer-const': 'error',
      
      // Allow console for backend logging but warn
      'no-console': 'warn',
      'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    },
  },
);