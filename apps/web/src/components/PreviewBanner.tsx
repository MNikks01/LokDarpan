import type React from "react";

import { previewCopy } from "@/copy/preview";
import { color, space } from "@/ui/tokens";

/** Shown on every page of the private preview, and nowhere else (ADR-078). */
export function PreviewBanner(): React.JSX.Element {
  return (
    <div
      role="note"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: `${String(space[2])}px ${String(space[4])}px`,
        background: color.text.primary,
        color: color.bg.surface,
        fontSize: 13,
        textAlign: "center",
      }}
    >
      {previewCopy.banner}
    </div>
  );
}
