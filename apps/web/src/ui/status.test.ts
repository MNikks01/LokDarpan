import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { PROJECT_STATUS, PROJECT_STATUS_ORDER } from "./status";
import { color } from "./tokens";

const isReddish = (hex: string): boolean => {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return r > 140 && r - g > 60 && r - b > 60;
};

/**
 * Guardrail: the map is where the no-red rule is easiest to break, because a
 * "delayed" road is exactly what a designer reaches for red to draw. These
 * assertions make that a failing build rather than a review comment.
 */
describe("work status presentation is a neutrality control", () => {
  it("uses no red for any recorded stage", () => {
    for (const status of PROJECT_STATUS_ORDER) {
      const presentation = PROJECT_STATUS[status];
      expect(isReddish(presentation.line), `${status} line`).toBe(false);
      expect(isReddish(presentation.badgeBg), `${status} badge background`).toBe(false);
      expect(isReddish(presentation.badgeFg), `${status} badge foreground`).toBe(false);
    }
  });

  it("never relies on colour alone: every stage has a glyph, a label and a line style", () => {
    const dashes = new Set<string>();
    for (const status of PROJECT_STATUS_ORDER) {
      const presentation = PROJECT_STATUS[status];
      expect(presentation.glyph.length, `${status} glyph`).toBeGreaterThan(0);
      expect(presentation.label.length, `${status} label`).toBeGreaterThan(0);
      dashes.add(presentation.dash === null ? "solid" : presentation.dash.join(","));
    }
    // A shared dash pattern would make two stages indistinguishable in
    // monochrome, which is the case colour-blind readers and printouts see.
    expect(dashes.size).toBe(PROJECT_STATUS_ORDER.length);
  });

  it("describes each stage without asserting a cause", () => {
    for (const status of PROJECT_STATUS_ORDER) {
      expect(PROJECT_STATUS[status].description.length).toBeGreaterThan(20);
    }
  });
});

/**
 * `globals.css` restates the palette as custom properties because a CSS module
 * cannot import a TypeScript constant. This test is the join between them: a
 * colour changed in one place and not the other fails here rather than shipping
 * a second, unguarded palette.
 */
describe("CSS custom properties mirror the token module", () => {
  const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

  const variable = (name: string): string => {
    const match = new RegExp(`--ld-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
    if (match?.[1] === undefined) throw new Error(`--ld-${name} is not declared in globals.css`);
    return match[1].toLowerCase();
  };

  it.each([
    ["canvas", color.bg.canvas],
    ["surface", color.bg.surface],
    ["raised", color.bg.raised],
    ["sunken", color.bg.sunken],
    ["hair", color.border.hair],
    ["border-strong", color.border.strong],
    ["text", color.text.primary],
    ["text-secondary", color.text.secondary],
    ["text-tertiary", color.text.tertiary],
    ["accent", color.accent.base],
    ["accent-soft", color.accent.soft],
    ["band-high-bg", color.band.high.bg],
    ["band-high-fg", color.band.high.fg],
  ])("--ld-%s matches the token", (name, expected) => {
    expect(variable(name)).toBe(expected.toLowerCase());
  });
});
