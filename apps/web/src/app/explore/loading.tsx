import type React from "react";
import { color } from "@/ui/tokens";

export default function Loading(): React.JSX.Element {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: color.bg.canvas,
      }}
      role="status"
    >
      <p style={{ fontSize: 14, color: color.text.secondary }}>Loading the map…</p>
    </div>
  );
}
