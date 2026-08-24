import { describe, it, expect } from "vitest";
import { color } from "./tokens";

/** Guardrail G3 (.docs/17-testing-strategy.md §6): no red in any data token. */
describe("palette is a neutrality control", () => {
  const isReddish = (hex: string): boolean => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return r > 140 && r - g > 60 && r - b > 60;
  };

  it("has no red in any verification-priority band", () => {
    for (const [name, band] of Object.entries(color.band)) {
      expect(isReddish(band.bg), `band ${name} bg`).toBe(false);
      expect(isReddish(band.fg), `band ${name} fg`).toBe(false);
    }
  });

  it("has no red in the missing-data treatment", () => {
    expect(isReddish(color.missing.bg)).toBe(false);
    expect(isReddish(color.missing.fg)).toBe(false);
  });

  it("pairs every band with a non-colour glyph (colour is never the only signal)", () => {
    for (const band of Object.values(color.band)) {
      expect(band.glyph.length).toBeGreaterThan(0);
    }
  });

  it("keeps red only for destructive actions", () => {
    expect(isReddish(color.destructive)).toBe(true);
  });
});
