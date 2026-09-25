import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // apps/web sets `jsx: "preserve"` so Next can compile it; the test runner has
  // no Next pipeline and must transform JSX itself, or a .test.tsx fails to
  // parse and silently reports "no tests" rather than failing.
  // Vite's Oxc transform since vitest 4; `esbuild.jsx` is no longer read.
  oxc: { jsx: { runtime: "automatic" } },
  // `@/` is apps/web's own alias, declared in its tsconfig. The test runner
  // resolves from the repository root and needs it spelled out here too.
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./apps/web/src/", import.meta.url)),
    },
  },
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
      // Floors, a point or so under the measured figures, to ratchet up from.
      // Branches read 80.7% when vitest 4 began counting the real branches of
      // files no test loads; tests for the GePNIC fetch and load, Overpass, the
      // review queue, the API server and the unit and department repositories
      // raised it to 89%. The largest remaining gaps: services/ingestion/src/
      // cag/{facts,client}.ts, gepnic/landing.ts and review/present.ts.
      thresholds: { branches: 88, functions: 94, statements: 95 },
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
        "services/ingestion/src/cag/cli.ts",
        "services/ingestion/src/cag/facts-cli.ts",
        "services/ingestion/src/cag/figure-link-cli.ts",
        "services/ingestion/src/cag/reprocess-cli.ts",
        "services/ingestion/src/ocr/manifest-cli.ts",
        "services/ingestion/src/ocr/score-cli.ts",
        "services/ingestion/src/cag/corpus-cli.ts",
        "services/ingestion/src/review/cli.ts",
        "services/ingestion/src/review/triage-cli.ts",
        "services/ingestion/src/osm/cli.ts",
        "services/ingestion/src/pincode/cli.ts",
        "services/ingestion/src/gepnic/resolve-cli.ts",
        "services/ingestion/src/gepnic/cli.ts",
        "services/ingestion/src/gepnic/sample-window.ts",
        "services/ingestion/src/gepnic/backfill-states.ts",
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
