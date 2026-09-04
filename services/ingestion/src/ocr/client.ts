import { OcrCapabilitiesSchema, OcrReadResponseSchema } from "@lokdarpan/contracts";
import type {
  OcrCapabilities,
  OcrPageReading,
  OcrReadRequest,
  OcrReadResponse,
} from "@lokdarpan/contracts";

import type { TextItem } from "../cag/extract";

/**
 * Talks to the OCR service, and to nothing else.
 *
 * The service is **optional infrastructure**. Ingestion ran for twenty
 * documents without it and must keep running without it: a page nobody could
 * read is a page recorded as unread, which is a true statement, whereas a
 * pipeline that halts because a sidecar is down turns a missing engine into a
 * missing corpus.
 *
 * So every failure here is returned as a value. There is no throw on an
 * unreachable service, and no default that quietly stands in for a reading.
 */

export interface OcrClientOptions {
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

/** Either the service answered, or it did not and says why. */
export type OcrOutcome<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly unavailable: string };

const DEFAULT_TIMEOUT_MS = 120_000;

export class OcrClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  public constructor(options: OcrClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/u, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Which engines the deployment can actually use, and at which versions. */
  public async capabilities(): Promise<OcrOutcome<OcrCapabilities>> {
    return this.request(`${this.baseUrl}/capabilities`, undefined, OcrCapabilitiesSchema);
  }

  public async read(
    request: OcrReadRequest,
    pdf: Uint8Array,
  ): Promise<OcrOutcome<OcrReadResponse>> {
    const body = new FormData();
    body.append("request", JSON.stringify(request));
    // Copied into a fresh buffer so the Blob owns its bytes: a Uint8Array view
    // over a pooled Node buffer can carry bytes from an unrelated read, and a
    // document that hashes to something else is refused further down.
    const bytes = new Uint8Array(pdf.length);
    bytes.set(pdf);
    body.append(
      "document",
      new Blob([bytes], { type: "application/pdf" }),
      `${request.document_sha256}.pdf`,
    );

    const outcome = await this.request(`${this.baseUrl}/read`, body, OcrReadResponseSchema);
    if (!outcome.ok) return outcome;

    // The service hashes the bytes it read and echoes the result. Checking it
    // here as well is not redundant: it is the difference between trusting a
    // sidecar and verifying that a reading belongs to the document it will be
    // filed against.
    if (outcome.value.document_sha256 !== request.document_sha256) {
      return {
        ok: false,
        unavailable:
          `the service read a document hashing to ${outcome.value.document_sha256}, ` +
          `and the request named ${request.document_sha256}`,
      };
    }
    return outcome;
  }

  private async request<T>(
    url: string,
    body: FormData | undefined,
    schema: { parse: (value: unknown) => T },
  ): Promise<OcrOutcome<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: body === undefined ? "GET" : "POST",
        ...(body === undefined ? {} : { body }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return { ok: false, unavailable: `${url} answered HTTP ${String(response.status)}` };
      }

      // A malformed body is not a reading. It is reported as unavailable rather
      // than parsed leniently, because a coordinate this side cannot check is a
      // highlight nobody can trust.
      return { ok: true, value: schema.parse(await response.json()) };
    } catch (error) {
      return {
        ok: false,
        unavailable: `${url} could not be reached: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * An OCR reading, in the shape the loader already stores.
 *
 * This is the whole point of the boundary. `document_text_item` holds a
 * character span and a box per item, and `extractFacts` locates a figure by
 * those spans — so a reading converted here is cited, located and reviewed by
 * the code that already exists, with no second pipeline and no second set of
 * rules about what counts as evidence.
 *
 * The confidence does not survive this conversion, and that is deliberate: a
 * `TextItem` is geometry, and the engine's confidence belongs to the reading it
 * came from, not to a coordinate.
 */
export function toTextItems(reading: OcrPageReading): TextItem[] {
  return reading.items.map((item) => ({
    seq: item.seq,
    charStart: item.char_start,
    charEnd: item.char_end,
    x0: item.x0,
    y0: item.y0,
    x1: item.x1,
    y1: item.y1,
  }));
}
