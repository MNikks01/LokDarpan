#!/usr/bin/env tsx
/**
 * Serve MapLibre's worker from this origin.
 *
 * MapLibre 6 runs its worker as an ES module loaded from a URL beside its own
 * module (`import.meta.url`). Bundled by Next, that URL is `file://`, which
 * MapLibre treats as "no worker", and the map never finishes loading. So the
 * worker and the shared chunk it imports are copied to
 * `public/maplibre/<version>/`, and `MapCanvas` points MapLibre at them.
 *
 * Versioned so a browser never runs a worker from one MapLibre release against
 * a main thread from another. Same origin, so there is no third-party request
 * and no cross-origin worker to allow. Runs before `dev` and `build`; the output
 * is gitignored, like the boundary geometry and the base map.
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packageJson = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(packageJson, "utf8")) as { version: string };
const dist = join(dirname(packageJson), "dist");
const target = join(import.meta.dirname, "..", "public", "maplibre", version);

mkdirSync(target, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(target, file));
}
process.stdout.write(`maplibre-gl ${version} worker → public/maplibre/${version}/\n`);
