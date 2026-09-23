#!/usr/bin/env tsx
/**
 * The explorer's initial JavaScript, measured from the build (ADR-062).
 *
 * Read from Next's manifests rather than from a running server, so it needs no
 * database and gives the same answer every time: which is what lets it fail a
 * pull request. The files are those the route's HTML loads before anything is
 * interactive — the root main files and the route's own page chunks — each
 * gzipped the way a CDN serves it.
 *
 * Run after `next build`:
 *   pnpm --filter @lokdarpan/web perf:bytes
 *
 * Exits 1 over a ceiling. Over a target it warns and exits 0: the target is
 * where the page should be, the ceiling is where it must not go.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { budgetsFor, formatValue, judge } from "./budgets";

const NEXT_DIR = join(import.meta.dirname, "..", ".next");

interface Manifest {
  readonly pages: Readonly<Record<string, readonly string[]>>;
}

/** The JS a route loads up front: its page entry, which Next lists with the root main files. */
export function initialScripts(manifest: Manifest, route: string): readonly string[] {
  const files = manifest.pages[route];
  if (files === undefined)
    throw new Error(`The build has no route ${route}. Run next build first.`);
  return [...new Set(files.filter((file) => file.endsWith(".js")))];
}

export function gzipBytes(content: Buffer): number {
  return gzipSync(content, { level: 9 }).byteLength;
}

function main(): number {
  const manifest = JSON.parse(
    readFileSync(join(NEXT_DIR, "app-build-manifest.json"), "utf8"),
  ) as Manifest;
  const files = initialScripts(manifest, "/explore/page");
  const sizes = files.map((file) => ({
    file,
    bytes: gzipBytes(readFileSync(join(NEXT_DIR, file))),
  }));
  const total = sizes.reduce((sum, s) => sum + s.bytes, 0);

  for (const { file, bytes } of [...sizes].sort((a, b) => b.bytes - a.bytes)) {
    process.stdout.write(`  ${formatValue("bytes", bytes).padStart(10)}  ${file}\n`);
  }

  let failed = false;
  for (const budget of budgetsFor("explore.initial-js", null)) {
    const verdict = judge(budget, total);
    const line = `${budget.metric}: ${formatValue("bytes", total)} (target ${formatValue("bytes", budget.target)}, ceiling ${budget.ceiling === null ? "none" : formatValue("bytes", budget.ceiling)}) — ${verdict}\n`;
    if (verdict === "over-ceiling") {
      process.stderr.write(line);
      failed = true;
    } else {
      process.stdout.write(line);
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] === import.meta.filename) process.exitCode = main();
