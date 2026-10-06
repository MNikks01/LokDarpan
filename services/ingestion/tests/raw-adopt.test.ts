import type pg from "pg";
import { describe, expect, it } from "vitest";

import { adoptRetainedArtifacts } from "../src/raw-adopt";
import type { ReadableRawStore } from "../src/raw-store";

/**
 * Rows from before 29 September have no `stored_in`, and a new row cannot be
 * written that way (`source_artifact_bytes_stored`), so the database a test can
 * build has none. The rule is checked against a stand-in instead: which rows
 * are asked about, and which are updated.
 */
function ledger(rows: { sha256: string; storage_path: string }[]): {
  db: pg.ClientBase;
  updated: string[];
} {
  const updated: string[] = [];
  const db = {
    query: (text: string, values: unknown[]) => {
      if (text.trimStart().startsWith("SELECT"))
        return Promise.resolve({ rows, rowCount: rows.length });
      updated.push(String(values[0]));
      return Promise.resolve({ rows: [], rowCount: 1 });
    },
  } as unknown as pg.ClientBase;
  return { db, updated };
}

const store = (held: Record<string, "verifies" | "differs" | "404">): ReadableRawStore =>
  ({
    location: "s3://a-bucket",
    get: (path: string) => {
      const state = held[path];
      if (state === "verifies") return Promise.resolve(Buffer.from("ok"));
      if (state === "differs") return Promise.reject(new Error(`Raw store: ${path} does not hash`));
      if (state === "404") return Promise.reject(new Error(`Raw store: GET ${path} returned 404.`));
      return Promise.reject(Object.assign(new Error("no such file"), { code: "ENOENT" }));
    },
  }) as unknown as ReadableRawStore;

describe("adoptRetainedArtifacts", () => {
  it("records a store only for rows whose bytes verify there", async () => {
    const { db, updated } = ledger([
      { sha256: "a".repeat(64), storage_path: "x/a" },
      { sha256: "b".repeat(64), storage_path: "x/b" },
      { sha256: "c".repeat(64), storage_path: "x/c" },
      { sha256: "d".repeat(64), storage_path: "x/d" },
    ]);
    const lines: string[] = [];
    const counts = await adoptRetainedArtifacts(
      db,
      store({ "x/a": "verifies", "x/b": "differs", "x/c": "404" }),
      "cag",
      (l) => lines.push(l),
    );
    expect(counts).toEqual({ adopted: 1, missing: 2, mismatched: 1 });
    expect(updated).toEqual(["a".repeat(64)]);
    expect(lines.join("\n")).toContain("does not verify in s3://a-bucket at x/b");
    expect(lines.join("\n")).toContain("not in s3://a-bucket at x/d");
  });
});
