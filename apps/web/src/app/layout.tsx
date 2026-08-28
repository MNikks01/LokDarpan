import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import type React from "react";
import { color } from "@/ui/tokens";

export const metadata: Metadata = {
  title: "LokDarpan — public finance, traceable to source",
  description:
    "Official government financial and infrastructure records, linked and checked for mathematical consistency. Every number links to its source.",
};

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
        <a href="#main" style={{ position: "absolute", left: -9999, top: 0 }}>
          Skip to main content
        </a>
        <main id="main" style={{ maxWidth: 880, margin: "0 auto", padding: 24 }}>
          {children}
        </main>
      </body>
    </html>
  );
}
