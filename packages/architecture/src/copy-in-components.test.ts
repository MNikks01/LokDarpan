import { describe, expect, it } from "vitest";
import { checkCopy, sentencesIn } from "./copy-in-components";

const component = (jsx: string) => `export const C = () => (${jsx});`;

describe("rule B: sentences live in copy/, not in components", () => {
  it("finds a sentence of six or more words in JSX text", () => {
    const found = sentencesIn(
      "a.tsx",
      component("<p>This describes what LokDarpan holds, not what was advertised.</p>"),
    );
    expect(found).toHaveLength(1);
    expect(found[0]?.line).toBe(1);
  });

  it("does not count labels, headings or button text", () => {
    expect(sentencesIn("a.tsx", component("<h2>Open tenders</h2>"))).toEqual([]);
    expect(sentencesIn("a.tsx", component("<button>Copy link to this view</button>"))).toEqual([]);
  });

  it("does not count text brought in from copy/", () => {
    expect(sentencesIn("a.tsx", component("<p>{tenderCopy.emptyHere}</p>"))).toEqual([]);
  });

  const tree = {
    "apps/web/src/components/A.tsx": component(
      "<><p>One sentence that is long enough to count here.</p><p>And another sentence that also counts as prose.</p></>",
    ),
    "apps/web/src/copy/share.tsx": component(
      "<p>Copy modules may hold as many sentences as they need.</p>",
    ),
    "apps/web/src/components/A.test.tsx": component(
      "<p>Tests may assert on sentences as long as they like.</p>",
    ),
  };
  const read = (path: string) => tree[path as keyof typeof tree];

  it("fails a file that holds more sentences than its baseline", () => {
    const result = checkCopy(Object.keys(tree), read, { "apps/web/src/components/A.tsx": 1 });
    expect(result.violations.map((v) => [v.file, v.allowed, v.sentences.length])).toEqual([
      ["apps/web/src/components/A.tsx", 1, 2],
    ]);
  });

  it("fails a file with no baseline that gains its first sentence", () => {
    expect(checkCopy(Object.keys(tree), read, {}).violations).toHaveLength(1);
  });

  it("passes at the baseline, and reports a file that went below it", () => {
    const result = checkCopy(Object.keys(tree), read, { "apps/web/src/components/A.tsx": 3 });
    expect(result.violations).toEqual([]);
    expect(result.improved).toEqual([
      { file: "apps/web/src/components/A.tsx", allowed: 3, now: 2 },
    ]);
  });

  it("ignores copy modules and tests entirely", () => {
    expect(Object.keys(checkCopy(Object.keys(tree), read, {}).counts)).toEqual([
      "apps/web/src/components/A.tsx",
    ]);
  });
});
