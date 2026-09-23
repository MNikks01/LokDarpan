import { describe, expect, it } from "vitest";
import { check, importsOf, resolveLocal } from "./import-directions";

/**
 * Negative fixtures: trees that must fail. A rule without one is a rule nobody
 * knows works (GEV's `check-import-directions` tests the same way).
 */
function run(tree: Record<string, string>) {
  return check(Object.keys(tree), (path) => tree[path] ?? "");
}

const rules = (tree: Record<string, string>) => run(tree).map((v) => v.rule);

describe("reading imports", () => {
  it("sees static, dynamic, re-exported, required and type-only imports", () => {
    const edges = importsOf(
      "a.ts",
      `import x from "one";
       import type { T } from "two";
       export { y } from "three";
       const z = await import("four");
       const w = require("five");
       import { formatAmount, type Money } from "@lokdarpan/money";`,
    );
    expect(edges.map((e) => e.specifier)).toEqual([
      "one",
      "two",
      "three",
      "four",
      "five",
      "@lokdarpan/money",
    ]);
    expect(edges[1]?.typeOnly).toBe(true);
    // An inline type is not a value name, so it cannot carry arithmetic.
    expect(edges[5]?.names).toEqual(["formatAmount"]);
  });

  it("resolves relative paths and apps/web's @/ alias among tracked files", () => {
    const files = new Set(["apps/web/src/lib/x.ts", "apps/web/src/map/index.ts"]);
    expect(resolveLocal("apps/web/src/components/a.tsx", "../lib/x", files)).toBe(
      "apps/web/src/lib/x.ts",
    );
    expect(resolveLocal("apps/web/src/components/a.tsx", "@/map", files)).toBe(
      "apps/web/src/map/index.ts",
    );
    expect(resolveLocal("apps/web/src/components/a.tsx", "react", files)).toBeNull();
  });
});

describe("rule C: rendering reaches no database, service or machine", () => {
  it("catches a direct import", () => {
    expect(rules({ "apps/web/src/components/A.tsx": `import pg from "pg";` })).toEqual(["C"]);
  });

  it("catches one reached through a local helper, and names the chain", () => {
    const [violation] = run({
      "apps/web/src/map/layer.ts": `import { q } from "@/lib/query";`,
      "apps/web/src/lib/query.ts": `import { readFile } from "node:fs/promises";`,
    });
    expect(violation).toMatchObject({
      rule: "C",
      file: "apps/web/src/map/layer.ts",
      specifier: "node:fs/promises",
      via: ["apps/web/src/lib/query.ts"],
    });
  });

  it("catches a dynamic import", () => {
    expect(
      rules({ "apps/web/src/components/A.tsx": `const db = await import("@lokdarpan/database");` }),
    ).toEqual(["C"]);
  });

  it("lets a type through: it is erased and carries no connection", () => {
    expect(
      rules({
        "apps/web/src/components/A.tsx": `import type { Row } from "@/server/rows";`,
        "apps/web/src/server/rows.ts": `import pg from "pg"; export type Row = {};`,
      }),
    ).toEqual([]);
  });

  it("survives an import cycle", () => {
    expect(
      rules({
        "apps/web/src/components/A.tsx": `import "./B";`,
        "apps/web/src/components/B.tsx": `import "./A";`,
      }),
    ).toEqual([]);
  });

  it("ignores tests, which may reach anything", () => {
    expect(rules({ "apps/web/src/components/A.test.tsx": `import pg from "pg";` })).toEqual([]);
  });
});

describe("rule A: client code only formats money", () => {
  it("refuses the Money class", () => {
    const [violation] = run({
      "apps/web/src/components/A.tsx": `import { Money } from "@lokdarpan/money";`,
    });
    expect(violation).toMatchObject({ rule: "A", reason: "takes Money from @lokdarpan/money" });
  });

  it("allows format functions and types", () => {
    expect(
      rules({
        "apps/web/src/components/A.tsx": `import { formatAmount, type Money } from "@lokdarpan/money";`,
      }),
    ).toEqual([]);
  });
});

describe("rules D, E, F and R", () => {
  it("D: an ingestion source may not import the UI", () => {
    expect(rules({ "services/ingestion/src/x.ts": `import { useState } from "react";` })).toEqual([
      "D",
    ]);
  });

  it("E: the domain may not read files", () => {
    expect(
      rules({ "packages/domain/src/x.ts": `import { readFileSync } from "node:fs";` }),
    ).toEqual(["E"]);
  });

  it("F: the map may not take ingestion types, not even as types", () => {
    expect(
      rules({ "apps/web/src/map/x.ts": `import type { RawTender } from "@lokdarpan/ingestion";` }),
    ).toEqual(["F"]);
  });

  it("R: label placement may not read the domain's figures", () => {
    expect(
      rules({
        "apps/web/src/map/labels/x.ts": `import { describeSources } from "@lokdarpan/domain";`,
      }),
    ).toEqual(["R"]);
  });
});
