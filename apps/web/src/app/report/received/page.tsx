import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { reportCopy as copy } from "@/copy/report";
import { color, space } from "@/ui/tokens";

export const metadata: Metadata = {
  title: `${copy.receivedTitle} — LokDarpan`,
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const REFERENCE = /^LD-[0-9A-F]{10}$/u;

/** What a reader sees after sending a report (ADR-075). */
export default async function ReceivedPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}): Promise<React.JSX.Element> {
  const { ref } = await searchParams;
  // Only a reference in the shape the database issues is echoed back.
  const reference = ref !== undefined && REFERENCE.test(ref) ? ref : null;
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: space[7] }}>
      <h1 style={{ fontSize: 26 }}>{copy.receivedTitle}</h1>
      <p style={{ fontSize: 17 }}>
        {reference === null ? copy.receivedNoReference : copy.receivedReference(reference)}
      </p>
      <p style={{ color: color.text.secondary }}>{copy.receivedNext}</p>
      <p>
        <Link href="/" style={{ color: color.accent.base }}>
          {copy.backToSite}
        </Link>
      </p>
    </main>
  );
}
