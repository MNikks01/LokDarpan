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
      // Correctness-critical domain logic is gated hard; UI is not.
      thresholds: { branches: 90 },
      include: ["packages/money/src/**", "packages/neutrality/src/**", "services/api/src/**"],
      exclude: ["**/fixtures/**", "**/index.ts"],
    },
  },
});
