import { fetchWithLimits, RETRY_IDEMPOTENT, textOf, type Http } from "../net/fetch-with-limits";
import { DATAGOVIN_PAGE } from "../net/limits";
import type { DirectoryRecord } from "./parse";

/**
 * The directory through the data.gov.in API — the channel the publisher built
 * for programmatic access.
 *
 * `data.gov.in` serves `Disallow: /`, so its pages and file downloads are not
 * fetched by any program here; its documented API is a separate, sanctioned
 * channel (`.docs/06-government-sources/access-and-permissions.md`). Reading a
 * record needs a key issued to a registered account, and none exists yet.
 *
 * The resource was identified through the keyless catalogue endpoint
 * (`/lists?filters[title]=pincode`) on 2026-09-25: "All India Pincode Directory
 * till last month", Ministry of Communications, Department of Posts, updated
 * 2025-10-03.
 */
export const PINCODE_RESOURCE = "5c2f62fe-5afa-4119-a499-fec9d604d5bd";

const API = "https://api.data.gov.in/resource";
const USER_AGENT =
  "LokDarpan/0.1 (public-infrastructure transparency; +https://github.com/MNikks01/LokDarpan)";

export interface ApiRead {
  readonly records: readonly DirectoryRecord[];
  /** Every page's body as received, in order: the bytes provenance points at. */
  readonly raw: string;
  /** The resource URL without the key, for the provenance record. */
  readonly sourceUrl: string;
}

/** One page's body, with the key scrubbed from any error before it leaves. */
async function fetchPage(url: URL, apiKey: string, http: Http | undefined): Promise<string> {
  try {
    const response = await fetchWithLimits({
      url: url.toString(),
      init: { headers: { "user-agent": USER_AGENT, accept: "application/json" } },
      limits: DATAGOVIN_PAGE,
      retry: RETRY_IDEMPOTENT,
      ...(http === undefined ? {} : { http }),
      accept: (r) => {
        if (!r.ok) throw new Error(`data.gov.in answered ${String(r.status)}`);
      },
    });
    return textOf(response);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.split(apiKey).join("<api-key>"));
  }
}

interface Page {
  readonly records?: DirectoryRecord[];
  readonly total?: number | string;
}

/**
 * Every record, a page at a time, with a pause between pages.
 *
 * The key travels as the documented `api-key` parameter and is never written
 * anywhere: not into the stored artefact, not into the source URL, and not into
 * an error, which is rewritten before it leaves if the key appears in it.
 */
export async function readDirectoryFromApi(options: {
  readonly apiKey: string;
  readonly resource?: string;
  readonly pageSize?: number;
  readonly pauseMs?: number;
  readonly http?: Http;
  readonly sleep?: (ms: number) => Promise<void>;
}): Promise<ApiRead> {
  const resource = options.resource ?? PINCODE_RESOURCE;
  const pageSize = options.pageSize ?? 1_000;
  const sleep =
    options.sleep ??
    ((ms: number) =>
      new Promise<void>((done) => {
        setTimeout(done, ms);
      }));
  const sourceUrl = `${API}/${resource}`;
  const records: DirectoryRecord[] = [];
  const pages: string[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const url = new URL(sourceUrl);
    url.searchParams.set("api-key", options.apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    const body = await fetchPage(url, options.apiKey, options.http);
    const page = JSON.parse(body) as Page;
    const batch = page.records ?? [];
    pages.push(body);
    records.push(...batch);
    const total = Number(page.total ?? 0);
    if (batch.length === 0 || records.length >= total) break;
    await sleep(options.pauseMs ?? 1_000);
  }

  return { records, raw: `[${pages.join(",\n")}]`, sourceUrl };
}
