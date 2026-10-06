import type pg from "pg";
import { describe, expect, it } from "vitest";

import { OcrClient } from "../src/ocr/client";
import { readUnreadPages } from "../src/ocr/read-pages";
import type { ReadableRawStore } from "../src/raw-store";

/**
 * The OCR service is optional infrastructure. When it cannot be asked, or has
 * no engine to read with, the run says so and touches nothing — these paths
 * return before the database is used, so neither a database nor a store is
 * needed to check them.
 */
const untouchable = new Proxy(
  {},
  {
    get(): never {
      throw new Error("nothing should be read or written when there is no one to read");
    },
  },
);
const db = untouchable as pg.ClientBase;
const store = untouchable as ReadableRawStore;

function serviceAnswering(engines: { name: string; available: boolean }[]): OcrClient {
  return new OcrClient({
    baseUrl: "http://ocr.test",
    fetch: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            contract_version: "ocr/1",
            engines: engines.map((e) => ({
              ...e,
              version: e.available ? "1.0" : null,
              detail: e.available ? null : "not installed",
            })),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
  });
}

describe("readUnreadPages with no one to read", () => {
  it("reports a service that cannot be reached, and writes nothing", async () => {
    const lines: string[] = [];
    const client = new OcrClient({
      baseUrl: "http://ocr.invalid",
      fetch: () => Promise.reject(new Error("ECONNREFUSED")),
    });
    const counts = await readUnreadPages(
      "a-source",
      { db, store, client },
      { log: (l) => lines.push(l) },
    );
    expect(counts).toMatchObject({ unavailable: 1, documents: 0, readings: 0 });
    expect(lines.join("\n")).toContain("ECONNREFUSED");
  });

  it("names the engines asked for that are not installed, and reads with none", async () => {
    const counts = await readUnreadPages("a-source", {
      db,
      store,
      client: serviceAnswering([
        { name: "tesseract", available: false },
        { name: "paddleocr", available: false },
      ]),
    });
    expect(counts).toMatchObject({ enginesMissing: ["tesseract", "paddleocr"], documents: 0 });
  });
});
