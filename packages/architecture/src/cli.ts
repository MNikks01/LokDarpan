/**
 * `pnpm architecture` — fails when any tracked file breaks an import rule (ADR-059).
 *
 * Every tracked file, not every bundled one: dead code must not be able to
 * hide a forbidden edge, which is how GEV scopes its own check.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
