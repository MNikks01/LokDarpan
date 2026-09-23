---
"@lokdarpan/web": patch
---

Upgrade past four published advisories, and make the audit gate apply the level it is given.

- `next` 15.5.23 → 15.5.26: two critical advisories, remote code execution through image optimisation
  and on Windows-hosted servers.
- `maplibre-gl` 5.24 → 6.11.1: a critical XSS in its HTML sanitiser, unpatched in any 5.x. MapLibre 6
  loads its worker as an ES module from beside its own module, which under Next is a `file://` URL,
  so the map did not load. The worker is now copied to `public/maplibre/<version>/` before `dev` and
  `build`, and `MapCanvas` points MapLibre at it. MapLibre 6 requires WebGL 2; a browser without it
  gets the map-unavailable message, as for any renderer error.
- `sharp` ≥ 0.35.4 and `js-yaml` ≥ 4.3.2, by override: high advisories in packages brought in by
  `next` and `@commitlint/cli`.

`audit-dependencies.sh` failed on advisories of any severity. With `--json`, pnpm 9 exits 1 on any
advisory whatever `--audit-level` says. It now applies the level to the report: advisories at or
above it fail, and those below are listed as a notice. Still listed: a moderate advisory in `vitest` 3,
fixed only in 4.
