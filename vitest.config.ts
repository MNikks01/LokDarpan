import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.test.tsx"],
    coverage: {
      // docs/15 correctness lives in the domain packages — gate them hard.
      thresholds: { branches: 95 },
      include: ["packages/money/src/**", "packages/neutrality/src/**"],
    },
  },
});
