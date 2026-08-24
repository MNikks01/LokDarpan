import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are shipped as TypeScript source, not built dist.
  transpilePackages: ["@lokdarpan/money", "@lokdarpan/neutrality", "@lokdarpan/contracts"],
  // Entity pages are ISR-rendered and revalidated by datasetVersion cache tag,
  // never by a timer. See .docs/27-web-architecture.md §Rendering strategy.
  experimental: { staleTimes: { dynamic: 0, static: 300 } },
  poweredByHeader: false,
};

export default config;
