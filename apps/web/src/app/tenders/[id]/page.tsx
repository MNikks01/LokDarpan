import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { TenderRecord } from "@lokdarpan/domain";

import { TenderPanel, TenderWithheld } from "@/components/TenderPanel";
import { tenderPageCopy } from "@/copy/tender";
import { ApiError, getJson } from "@/lib/api";
import { color, radius, space } from "@/ui/tokens";

export const dynamic = "force-dynamic";

type Loaded =
  | { readonly withheld: true; readonly portalUrl: string | null }
  | { readonly withheld: false; readonly record: TenderRecord };

/** One tender's record (ADR-079), or the withheld notice the public sees until permission. */
async function load(id: string): Promise<Loaded> {
  try {
    const { data } = await getJson(`/api/v1/tenders/${encodeURIComponent(id)}`);
    return data as Loaded;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(id);
  return {
    title: loaded.withheld ? tenderPageCopy.withheldTitle : `${loaded.record.title} — LokDarpan`,
    // Details are withheld from the public, so there is nothing for a search
    // engine to index; in a preview the layout already says noindex.
    robots: { index: false },
  };
}

export default async function TenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const loaded = await load(id);
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: space[4],
        borderRadius: radius.md,
        background: color.bg.surface,
      }}
    >
      {loaded.withheld ? (
        <TenderWithheld portalUrl={loaded.portalUrl} />
      ) : (
        <TenderPanel record={loaded.record} />
      )}
    </div>
  );
}
