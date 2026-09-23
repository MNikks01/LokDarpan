---
---

Upgrade vitest and `@vitest/coverage-v8` from 3 to 4.1.11, which clears the last advisory: a moderate
path traversal in `@vitest/mocker`. `pnpm audit` now reports no known vulnerabilities.

JSX in tests is now compiled by Oxc (`oxc.jsx`). Vitest 4 no longer reads `esbuild.jsx`.

The branch coverage threshold moves from 90 to 80. The measurement changed, not the code. Vitest 3
counted a file no test loads as one branch; vitest 4 counts its real branches. The same tree reads
80.7% instead of 90.4%. 80 is a floor to ratchet up from. The untested files that account for most of
the gap are named in `vitest.config.ts`.
