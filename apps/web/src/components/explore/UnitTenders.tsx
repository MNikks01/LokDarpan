"use client";

import type React from "react";
import { useState } from "react";

import { TenderCard } from "./TenderCard";
import { TenderList, type TenderSummary } from "./tenders";

/**
 * A place's tenders, and the one a reader opened. Picking a tender swaps the
 * list for its record; "Back to the list" swaps it back, as a map app does with
 * a place and its search results.
 */
export function UnitTenders(props: {
  readonly heading: string;
  readonly tenders: readonly TenderSummary[];
  readonly loading: boolean;
  readonly detailsWithheld: boolean;
  readonly heldCount: number;
  readonly portalUrl: string | null;
  readonly collectingSince: string | null;
}): React.JSX.Element {
  const [open, setOpen] = useState<number | null>(null);
  if (open !== null) {
    return (
      <TenderCard
        tenderId={open}
        onBack={() => {
          setOpen(null);
        }}
      />
    );
  }
  return <TenderList {...props} onOpen={setOpen} />;
}
