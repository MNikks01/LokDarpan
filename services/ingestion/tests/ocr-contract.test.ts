import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  OcrCapabilitiesSchema,
  OcrReadRequestSchema,
  OcrReadResponseSchema,
} from "@lokdarpan/contracts";

import { OcrClient, toTextItems } from "../src/ocr/client";

/**
 * The OCR service is Python and this is TypeScript, so the two contracts cannot
 * be checked against each other. They are each checked against the same bytes:
 * the documents in `services/ocr/contract`, which the Python suite validates
 * with the same expectations.
 *
 * A change that loosens one side alone fails here rather than diverging quietly
 * until a coordinate lands on the wrong figure.
 */
const CONTRACT = join(import.meta.dirname, "../../ocr/contract");

const SCHEMAS: Record<string, { parse: (v: unknown) => unknown }> = {
  "read-request.json": OcrReadRequestSchema,
  "read-response.json": OcrReadResponseSchema,
  "read-response-no-engines.json": OcrReadResponseSchema,
  "read-response-empty-page.json": OcrReadResponseSchema,
  "capabilities.json": OcrCapabilitiesSchema,
};

const read = (kind: string, name: string): unknown =>
  JSON.parse(readFileSync(join(CONTRACT, kind, name), "utf8"));

describe("the shared contract documents", () => {
  const examples = readdirSync(join(CONTRACT, "examples")).sort();
  const rejected = readdirSync(join(CONTRACT, "rejected")).sort();

  it("has a schema for every example, so none goes unchecked", () => {
    expect(examples).toEqual(Object.keys(SCHEMAS).sort());
  });

  it.each(examples)("accepts %s", (name) => {
    expect(() => SCHEMAS[name]?.parse(read("examples", name))).not.toThrow();
  });

  it.each(rejected)("refuses %s", (name) => {
    expect(() => OcrReadResponseSchema.parse(read("rejected", name))).toThrow();
  });
});

describe("a reading converts to what the loader already stores", () => {
  it("keeps the span and the box, and drops the confidence", () => {
    const response = OcrReadResponseSchema.parse(read("examples", "read-response.json"));
    const reading = response.readings[0];
    if (reading === undefined) throw new Error("expected a reading");

    const items = toTextItems(reading);
    expect(items).toHaveLength(reading.items.length);
    // A TextItem is geometry. The engine's confidence belongs to the reading it
    // came from, not to a coordinate, so it does not travel into the item.
    expect(items[0]).not.toHaveProperty("confidence");
    expect(items[0]).toEqual({
      seq: 0,
      charStart: 0,
      charEnd: 2,
      x0: 72,
      y0: 700,
      x1: 88,
      y1: 709,
    });
  });

  it("produces spans that address the reading's own content", () => {
    const response = OcrReadResponseSchema.parse(read("examples", "read-response.json"));
    for (const reading of response.readings) {
      for (const item of toTextItems(reading)) {
        expect(reading.content.slice(item.charStart, item.charEnd).length).toBeGreaterThan(0);
      }
    }
  });
});

describe("the client treats the service as optional", () => {
  const stub = (impl: () => Promise<Response>): typeof globalThis.fetch => impl;

  const request = {
    contract_version: "ocr/1" as const,
    document_sha256: "3f".padEnd(64, "a"),
    page_numbers: [1],
    engines: ["tesseract"],
    languages: ["eng"],
    dpi: 300,
  };

  it("reports an unreachable service rather than throwing", async () => {
    const client = new OcrClient({
      baseUrl: "http://ocr.invalid",
      fetch: stub(() => Promise.reject(new Error("ECONNREFUSED"))),
    });

    const outcome = await client.capabilities();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.unavailable).toContain("ECONNREFUSED");
  });

  it("reports an error status rather than parsing the body", async () => {
    const client = new OcrClient({
      baseUrl: "http://ocr.test",
      fetch: stub(() => Promise.resolve(new Response("nope", { status: 503 }))),
    });

    const outcome = await client.capabilities();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.unavailable).toContain("503");
  });

  it("refuses a reading of a document other than the one it asked about", async () => {
    // A reading filed against the wrong document attaches a figure to a source
    // that does not contain it, so the echoed hash is checked on this side too.
    const body = read("examples", "read-response.json") as { document_sha256: string };
    const client = new OcrClient({
      baseUrl: "http://ocr.test",
      fetch: stub(() =>
        Promise.resolve(
          new Response(JSON.stringify({ ...body, document_sha256: "b".repeat(64) }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    });

    const outcome = await client.read(request, new Uint8Array([1, 2, 3]));
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.unavailable).toContain("named");
  });

  it("reports a malformed body rather than accepting a coordinate it cannot check", async () => {
    const client = new OcrClient({
      baseUrl: "http://ocr.test",
      fetch: stub(() =>
        Promise.resolve(
          new Response(JSON.stringify({ contract_version: "ocr/1" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        ),
      ),
    });

    const outcome = await client.capabilities();
    expect(outcome.ok).toBe(false);
  });
});

describe("the client when the service answers", () => {
  const stub = (
    impl: (url: string, init?: RequestInit) => Promise<Response>,
  ): typeof globalThis.fetch => impl as unknown as typeof globalThis.fetch;

  const json = (body: unknown): Response =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  it("returns the readings, and the refusals that explain what is missing", async () => {
    const body = read("examples", "read-response.json") as { document_sha256: string };
    const client = new OcrClient({
      baseUrl: "http://ocr.test",
      fetch: stub(() => Promise.resolve(json(body))),
    });

    const outcome = await client.read(
      {
        contract_version: "ocr/1",
        document_sha256: body.document_sha256,
        page_numbers: [83, 84],
        engines: ["tesseract", "paddleocr"],
        languages: ["eng", "mar"],
        dpi: 300,
      },
      new Uint8Array([1, 2, 3]),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // Two engines read one page and produce two readings. Nothing here merges
    // them, and the refusal for the page one engine could not render survives
    // rather than being dropped for tidiness.
    expect(outcome.value.readings).toHaveLength(2);
    expect(outcome.value.refusals).toHaveLength(1);
    expect(outcome.value.refusals[0]?.engine).toBe("paddleocr");
  });

  it("reports an engine that is not installed, with the reason", async () => {
    const body = read("examples", "read-response-no-engines.json") as { document_sha256: string };
    const client = new OcrClient({
      baseUrl: "http://ocr.test",
      fetch: stub(() => Promise.resolve(json(body))),
    });

    const outcome = await client.read(
      {
        contract_version: "ocr/1",
        document_sha256: body.document_sha256,
        page_numbers: [1],
        engines: ["paddleocr"],
        languages: ["en"],
        dpi: 300,
      },
      new Uint8Array([1]),
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    // A short response is not a clean one: no readings, and a refusal saying why.
    expect(outcome.value.readings).toEqual([]);
    expect(outcome.value.refusals[0]?.reason).toContain("not installed");
  });

  it("does not double the slash when the base url carries one", async () => {
    const urls: string[] = [];
    const client = new OcrClient({
      baseUrl: "http://ocr.test/",
      fetch: stub((url) => {
        urls.push(url);
        return Promise.resolve(json(read("examples", "capabilities.json")));
      }),
    });

    await client.capabilities();
    expect(urls[0]).toBe("http://ocr.test/capabilities");
  });

  it("gives up rather than hanging when the service stops answering", async () => {
    const client = new OcrClient({
      baseUrl: "http://ocr.test",
      timeoutMs: 5,
      fetch: stub(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      ),
    });

    const outcome = await client.capabilities();
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.unavailable).toContain("aborted");
  });
});
