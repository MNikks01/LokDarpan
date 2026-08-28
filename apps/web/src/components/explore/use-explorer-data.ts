"use client";

import { useEffect, useState } from "react";
import type { DocumentSummary } from "@lokdarpan/domain";
import type { DistrictSummary } from "@/domain/geography";

/**
 * The explorer's reads, one hook per resource.
 *
 * Each aborts its in-flight request when its input changes, which is what stops
 * a reader clicking through four places quickly from ending up with the second
 * one's records under the fourth one's heading. Each fails closed to an empty
 * result rather than to stale data: showing the previous area's records under a
 * new heading is worse than showing none.
 */

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} returned ${String(response.status)}`);
  return (await response.json()) as T;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function useDistricts(stateCode: string | null): {
  readonly districts: readonly DistrictSummary[];
  readonly loading: boolean;
} {
  const [districts, setDistricts] = useState<readonly DistrictSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stateCode === null) {
      setDistricts([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    readJson<{ data: { districts: DistrictSummary[] } }>(
      `/api/v1/places/districts?state=${encodeURIComponent(stateCode)}`,
      controller.signal,
    )
      .then((body) => {
        setDistricts(body.data.districts);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setDistricts([]);
        setLoading(false);
      });
    return () => {
      controller.abort();
    };
  }, [stateCode]);

  return { districts, loading };
}

export interface RecordsState {
  readonly documents: readonly DocumentSummary[];
  readonly loading: boolean;
  readonly failed: boolean;
}

/**
 * Documents recorded against a unit, by LGD code.
 *
 * The map's state codes are Census/LGD state codes — Maharashtra is `27` in
 * both — so the map's selection addresses the ledger directly, with no name
 * matching in between.
 */
export function useRecords(lgdCode: string | null): RecordsState {
  const [state, setState] = useState<RecordsState>({
    documents: [],
    loading: false,
    failed: false,
  });

  useEffect(() => {
    if (lgdCode === null) {
      setState({ documents: [], loading: false, failed: false });
      return;
    }
    const controller = new AbortController();
    setState({ documents: [], loading: true, failed: false });

    readJson<{ data: { documents: DocumentSummary[] } }>(
      `/api/v1/documents?unit=${encodeURIComponent(lgdCode)}`,
      controller.signal,
    )
      .then((body) => {
        setState({ documents: body.data.documents, loading: false, failed: false });
      })
      .catch((error: unknown) => {
        if (isAbort(error)) return;
        setState({ documents: [], loading: false, failed: true });
      });

    return () => {
      controller.abort();
    };
  }, [lgdCode]);

  return state;
}
