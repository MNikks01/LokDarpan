import { ImageResponse } from "next/og";
import { homeCopy } from "@/copy/home";

/**
 * The preview shown when the homepage is shared.
 *
 * Text and a schematic of connected records, in the site's own palette. No
 * photograph, no map outline (ADR-066: the site claims no boundary it did not
 * load from a source), and no figure: a shared image travels without the source
 * link a figure must carry.
 */
export const alt = homeCopy.metaTitle;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage(): ImageResponse {
  const nodes = [
    { x: 760, y: 360, label: "PLACE", solid: true },
    { x: 880, y: 200, label: "REPORT", solid: true },
    { x: 1030, y: 200, label: "PAGE", solid: true },
    { x: 1030, y: 330, label: "FIGURE", solid: true },
    { x: 680, y: 500, label: "WORK", solid: false },
    { x: 880, y: 500, label: "TENDER", solid: false },
  ];
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#FBFBFA",
        color: "#14181A",
        padding: 72,
        position: "relative",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: 600 }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: 4,
            color: "#0F766E",
            textTransform: "uppercase",
            marginBottom: 28,
          }}
        >
          {homeCopy.hero.eyebrow}
        </div>
        <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -3, marginBottom: 24 }}>
          LokDarpan
        </div>
        <div style={{ fontSize: 40, lineHeight: 1.2, color: "#55605F" }}>
          {homeCopy.hero.headline}
        </div>
      </div>
      {nodes.map((node) => (
        <div
          key={node.label}
          style={{
            position: "absolute",
            left: node.x,
            top: node.y,
            display: "flex",
            padding: "10px 16px",
            fontSize: 20,
            letterSpacing: 2,
            borderRadius: 8,
            background: "#FFFFFF",
            color: node.solid ? "#0F766E" : "#7A8483",
            border: node.solid ? "2px solid #0F766E" : "2px dashed #C9CDC9",
          }}
        >
          {node.label}
        </div>
      ))}
    </div>,
    size,
  );
}
