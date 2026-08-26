import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
      "apps/**/*.test.tsx",
      "services/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      // Correctness-critical logic is gated hard; UI is not.
      thresholds: { branches: 90, functions: 85, statements: 85 },
      include: [
        "packages/money/src/**",
        "packages/neutrality/src/**",
        "packages/database/src/**",
        "packages/observability/src/**",
        "packages/domain/src/**",
        "packages/errors/src/**",
        "services/api/src/**",
        "services/ingestion/src/**",
      ],
      exclude: [
        "**/fixtures/**",
        // Process entrypoints: top-level side effects, signal handlers and
        // process.exit. Covered by the E2E and integration suites instead of
        // being contorted into unit tests.
        "services/api/src/index.ts",
        "packages/neutrality/src/cli.ts",
        "packages/database/src/cli.ts",
        "services/ingestion/src/cli.ts",
        "services/ingestion/src/beams/cli.ts",
        "services/ingestion/src/beams/actuals-cli.ts",
        // Pure re-export barrels.
        "packages/contracts/src/index.ts",
        "packages/database/src/index.ts",
        "packages/observability/src/index.ts",
        "packages/domain/src/index.ts",
        "services/ingestion/src/index.ts",
      ],
    },
  },
});
