/**
 * `pnpm architecture` — fails when any tracked file breaks an import rule, or a
 * component gains a sentence that belongs in copy/ (ADR-059, rules A–F and B).
 *
 *   pnpm architecture --write-copy-baseline   record the sentence counts as they stand
 *
 * Every tracked file, not every bundled one: dead code must not be able to
 * hide a forbidden edge, which is how GEV scopes its own check.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkCopy, type Baseline, MIN_WORDS } from "./copy-in-components";
import { RULES, check } from "./import-directions";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const paths = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .split("\0")
  .filter((path) => path !== "");

const violations = check(paths, (path) => readFileSync(`${root}/${path}`, "utf8"));

for (const v of violations) {
  const via = v.via.length === 0 ? "" : ` (via ${v.via.join(" → ")})`;
  process.stderr.write(`✗ rule ${v.rule}: ${v.file} ${v.reason}${via}\n`);
}
if (violations.length > 0) {
  process.stderr.write(`\n${String(violations.length)} import-direction violation(s). Rules:\n`);
  for (const rule of RULES) process.stderr.write(`  ${rule.id}. ${rule.description}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`✓ import directions: ${String(RULES.length)} rules hold\n`);
}

// ── Rule B ─────────────────────────────────────────────────────────────────
const baselinePath = join(import.meta.dirname, "..", "copy-baseline.json");
const read = (path: string): string => readFileSync(`${root}/${path}`, "utf8");
const copy = checkCopy(paths, read, JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline);

if (process.argv.includes("--write-copy-baseline")) {
  const sorted = Object.fromEntries(
    Object.entries(copy.counts).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(baselinePath, `${JSON.stringify(sorted, null, 2)}\n`);
  process.stdout.write(`wrote ${baselinePath}\n`);
} else if (copy.violations.length > 0) {
  for (const v of copy.violations) {
    process.stderr.write(
      `✗ rule B: ${v.file} holds ${String(v.sentences.length)} sentence(s) of ${String(MIN_WORDS)}+ words; its baseline is ${String(v.allowed)}. Move the new one to apps/web/src/copy/:\n`,
    );
    for (const s of v.sentences)
      process.stderr.write(`    ${String(s.line)}: ${s.text.slice(0, 90)}\n`);
  }
  process.exitCode = 1;
} else {
  const total = Object.values(copy.counts).reduce((sum, n) => sum + n, 0);
  process.stdout.write(
    `✓ rule B: no component gained a sentence (${String(total)} remain to move to copy/)\n`,
  );
  for (const i of copy.improved) {
    process.stdout.write(
      `  ${i.file} is down to ${String(i.now)} from ${String(i.allowed)}: run with --write-copy-baseline to lock that in\n`,
    );
  }
}
