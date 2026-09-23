"use client";

import { useEffect, useState } from "react";
import { ResourceCache, type Versioned } from "./resource-cache";

/** One cache per page load, shared by every panel so their reads coalesce. */
export const resources = new ResourceCache();

export interface ResourceState<T> {
  /** Null while loading, after a failure, and when there is nothing to ask for. */
  readonly data: T | null;
  readonly datasetVersion: number | null;
  readonly loading: boolean;
  readonly failed: boolean;
}

interface Held<T> {
  readonly url: string | null;
  readonly value: Versioned<T> | null;
  readonly failed: boolean;
}

/** The newest dataset version any response on this page has named; 0 before the first. */
export function useWatermark(): number {
  const [watermark, setWatermark] = useState(resources.watermark);
  useEffect(() => {
    setWatermark(resources.watermark);
    return resources.subscribe(setWatermark);
  }, []);
  return watermark;
}

/**
 * Read one API resource through the shared cache.
 *
 * A result is only ever shown under the URL it was read for. The component
 * moving on no longer aborts the request — other panels may share it, and the
 * result is kept for the reader coming back — so a late result for a URL that
 * is no longer asked for is ignored instead. That is what stops a reader
 * clicking through four places quickly from seeing the second one's data under
 * the fourth one's heading.
 *
 * When any read reveals a newer dataset version, this reads again. Until the
 * new result arrives the previous one for the same URL stays on screen: it is
 * still what that URL said, and blanking it would read as the data vanishing.
 */
export function useResource<T>(url: string | null): ResourceState<T> {
  const [held, setHeld] = useState<Held<T>>(() => ({
    url,
    value: url === null ? null : resources.peek<T>(url),
    failed: false,
  }));
  const [watermark, setWatermark] = useState(resources.watermark);

  useEffect(() => resources.subscribe(setWatermark), []);

  useEffect(() => {
    if (url === null) {
      setHeld({ url, value: null, failed: false });
      return;
    }
    let current = true;
    const cached = resources.peek<T>(url);
    setHeld((previous) => ({
      url,
      value: cached ?? (previous.url === url ? previous.value : null),
      failed: false,
    }));
    resources.read<T>(url).then(
      (value) => {
        if (current) setHeld({ url, value, failed: false });
      },
      () => {
        // Fails closed to nothing rather than to a previous result.
        if (current) setHeld({ url, value: null, failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, [url, watermark]);

  // Between a URL changing and the effect running, what is held belongs to the
  // old URL and must not be shown under the new one.
  const value = held.url === url ? held.value : url === null ? null : resources.peek<T>(url);
  const failed = held.url === url && held.failed;
  return {
    data: value?.data ?? null,
    datasetVersion: value?.datasetVersion ?? null,
    loading: url !== null && value === null && !failed,
    failed,
  };
}
