import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import type React from "react";
import { PreviewBanner } from "@/components/PreviewBanner";
import { internalPreview } from "@/server/publishable";
import { color } from "@/ui/tokens";

const BASE_METADATA: Metadata = {
  title: "LokDarpan — public finance, traceable to source",
  description:
    "Official government financial and infrastructure records, linked and checked for mathematical consistency. Every number links to its source.",
};

/** A private preview tells search engines to keep out (ADR-078). */
export function generateMetadata(): Metadata {
  return internalPreview()
    ? { ...BASE_METADATA, robots: { index: false, follow: false, nocache: true } }
    : BASE_METADATA;
}

export default function RootLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: color.bg.canvas,
          color: color.text.primary,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        {internalPreview() && <PreviewBanner />}
        <a href="#main" style={{ position: "absolute", left: -9999, top: 0 }}>
          Skip to main content
        </a>
        <main id="main" className="ld-main">
          {children}
        </main>
      </body>
    </html>
  );
}
