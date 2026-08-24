#!/usr/bin/env tsx
/**
 * CI gate: scan i18n catalogues and source strings for forbidden language.
 * Exit 1 on any violation — docs/15 §Enforcement makes a hit a release blocker.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { scan } from "./index";

const ROOTS = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ["apps", "packages"];
const SCANNABLE = new Set([".json", ".ts", ".tsx", ".md"]);
// Test and spec files are excluded: a test asserting that forbidden language
// is ABSENT must be able to name it — the same reason vocabulary.ts is excluded.
const SKIP =
  /node_modules|\.next|dist|\/vocabulary\.(ts|js)$|\.(test|spec)\.(ts|tsx)$|\/e2e\/|\/tests?\/|\/\.docs\/|\/docs\//;

let violations = 0;

function walk(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (SKIP.test(full)) continue;
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full);
      continue;
    }
    if (!SCANNABLE.has(extname(full))) continue;
    let content = readFileSync(full, "utf8");
    if (extname(full) === ".ts" || extname(full) === ".tsx") {
      // Strip comments: source comments legitimately quote forbidden examples
      // (e.g. "<Observation text=\"...overcharged\"> // ← compile error").
      // What ships to a reader is string literals and JSX text, not comments.
      content = content
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1 ");
    }
    const found = scan(content);
    for (const v of found) {
      violations++;
      const hint = v.suggestion ? `  → use: ${v.suggestion}` : "";
      console.error(`${full}: forbidden ${v.kind} "${v.match}" (${v.locale})${hint}`);
    }
  }
}

for (const root of ROOTS) walk(root);

if (violations > 0) {
  console.error(
    `\n✗ neutrality: ${String(violations)} violation(s). docs/15 forbids this language.`,
  );
  process.exit(1);
}
console.log("✓ neutrality: clean");
