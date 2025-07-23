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
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // General ESLint rules
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      
      // Code style - more lenient for backend
      'max-len': ['warn', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    },
  },
  ...tseslint.configs.recommended,
);