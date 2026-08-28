import type React from "react";
import { color } from "@/ui/tokens";

export default function Home(): React.JSX.Element {
  return (
    <>
      <h1 style={{ fontSize: 28 }}>LokDarpan</h1>
      <p style={{ color: color.text.secondary, maxWidth: "62ch" }}>
        Foundation scaffold (W1). Official records, linked and checked for mathematical consistency
        — every number traceable to its source.
      </p>
      <p style={{ marginTop: 24, fontSize: 17 }}>
        <a href="/explore" style={{ color: color.accent.base, fontWeight: 600 }}>
          Explore infrastructure on the map →
        </a>
      </p>
      <p style={{ marginTop: 8 }}>
        <a href="/project/501" style={{ color: color.accent.base }}>
          Example project — fixture-backed →
        </a>
      </p>
      <p style={{ fontSize: 13, color: color.text.tertiary, marginTop: 32, maxWidth: "62ch" }}>
        ⚠ Figures shown are FIXTURE data, not government sources. The backend does not exist yet
        (.docs/28 §Backend dependencies).
      </p>
    </>
  );
}
