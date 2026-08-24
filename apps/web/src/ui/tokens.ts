/**
 * Design tokens — .docs/06-design-system.md.
 *
 * THE PALETTE IS A NEUTRALITY CONTROL, not only an aesthetic one.
 * There is no red in any variance, severity, verification-priority or status
 * token. A red badge asserts wrongdoing before a word is read, which docs/15
 * forbids. Red exists solely for destructive user actions.
 * A CI test asserts this (tokens.test.ts).
 */
export const color = {
  bg:     { canvas: "#FBFBFA", surface: "#FFFFFF", raised: "#F4F5F4", sunken: "#F0F1F0" },
  border: { hair: "#E3E5E3", strong: "#C9CDC9" },
  text:   { primary: "#14181A", secondary: "#55605F", tertiary: "#7A8483" },
  accent: { base: "#0F766E", soft: "#E6F2F0" },
  /** Verification-priority bands — an amber ramp, deliberately quiet. No red. */
  band: {
    low:       { bg: "#E8EDEC", fg: "#2F4F4C", glyph: "○" },
    medium:    { bg: "#DCE6E4", fg: "#1F3E3B", glyph: "◔" },
    high:      { bg: "#EFE3CB", fg: "#6B4E14", glyph: "◑" },
    very_high: { bg: "#E5D2AE", fg: "#4A360C", glyph: "◕" },
  },
  /** Coverage gaps: neutral slate. A publication gap is not a finding. */
  missing: { bg: "#F0F1F0", fg: "#55605F", glyph: "▤" },
  /** Reserved for destructive user actions ONLY — never for data. */
  destructive: "#B3261E",
} as const;

export const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64] as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20 } as const;
export const figureFontFeatures = { fontVariantNumeric: "tabular-nums lining-nums" } as const;
