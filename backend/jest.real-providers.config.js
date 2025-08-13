/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  modulePathIgnorePatterns: ["/dist/"],
  // No setup files - completely standalone with real providers
  setupFilesAfterEnv: [],
  // Load real environment variables (optional). If missing, skip to avoid config error in CI.
  setupFiles: [],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        isolatedModules: true,
        tsconfig: {
          skipLibCheck: true,
          noImplicitAny: false,
        },
      },
    ],
  },
};
