import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The deployment-protection bypass lets a request past Vercel's protection. It
 * exists for the server to call its own deployment, and a copy in the browser
 * bundle would hand that bypass to every reader.
 *
 * Next only inlines `NEXT_PUBLIC_*` variables into client code, so the secret
 * cannot leak by being read from a client component — it would read as
 * undefined. What can leak it is a module that reads it being imported by one,
 * or someone renaming it with the public prefix to "make it work". Both are
 * checked here, over the source rather than the bundle, so the failure names the
 * file.
 */
const SRC = fileURLToPath(new URL("..", import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/u.test(name) && !/\.test\.tsx?$/u.test(name) ? [path] : [];
  });
}

const files = sources(SRC).map((path) => ({
  path: relative(SRC, path),
  text: readFileSync(path, "utf8"),
}));

describe("the protection bypass stays on the server", () => {
  it("is read only by modules that cannot be imported into client code", () => {
    const readers = files.filter((f) => f.text.includes("VERCEL_AUTOMATION_BYPASS_SECRET"));
    expect(readers.length).toBeGreaterThan(0);
    for (const reader of readers) {
      expect(reader.text, reader.path).toMatch(/^import "server-only";/mu);
      expect(reader.text, reader.path).not.toMatch(/^"use client";/mu);
    }
  });

  it("is never given a name the client bundle would inline", () => {
    for (const file of files) {
      expect(file.text, file.path).not.toMatch(/NEXT_PUBLIC_\w*(BYPASS|SECRET|TOKEN)/u);
    }
  });
});
