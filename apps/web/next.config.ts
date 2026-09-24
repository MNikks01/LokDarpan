import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source, not built dist.
  transpilePackages: [
    "@lokdarpan/money",
    "@lokdarpan/neutrality",
    "@lokdarpan/contracts",
    "@lokdarpan/domain",
    "@lokdarpan/errors",
    "@lokdarpan/database",
    "@lokdarpan/observability",
  ],
  // Entity pages are ISR-rendered and revalidated by datasetVersion cache tag,
  // never by a timer. See .docs/27-web-architecture.md §Rendering strategy.
  experimental: { staleTimes: { dynamic: 0, static: 300 } },
  poweredByHeader: false,
  // The explorer reads the geometry manifest from disk (`data/geography.ts`) by
  // a path built from `process.cwd()`, which file tracing cannot follow. Named
  // here so it is packaged with that function on Vercel, rather than missing and
  // showing the "geometry not installed" page in production.
  outputFileTracingIncludes: { "/explore": ["./public/geo/manifest.json"] },
};

export default config;
