import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PathNotPermitted, PoliteClient } from "../src/maharashtra/http";
import {
  ListingNotUnderstood,
  isoDateOf,
  listingFactsOf,
  listingPageUrl,
  parseMhadaListing,
} from "../src/maharashtra/mhada";
import type { HttpInit } from "../src/net/fetch-with-limits";
import { AGENCY_PAGE } from "../src/net/limits";

const fixture = (name: string): string => readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("MHADA's listing, as served on 2026-09-30", () => {
  it("reads the newest page: ten notices, every field as printed", () => {
    const { rows, lastPage } = parseMhadaListing(fixture("mhada-tenders-page0-2026-09-30.html"));
    expect(rows).toHaveLength(10);
    expect(lastPage).toBe(454);
    expect(rows[0]).toEqual({
      serial: "1",
      published: "30 September 2026",
      publishedOn: "2026-09-30",
      title: "ई निविदा सूचना क्र. ३७३९",
      reference: "ई-निविदा सुचना क्र.:- का.अ. (पश्चिम) / मुं.झो.सु.मंडळ/ई-निविदा/ १३४ / २०२६-२७",
      board: "मुंबई झोपडपट्टी सुधार मंडळ",
      description: "कार्यकारी अभियंत्याच्या १६ कामांसाठी ई निविदा सूचना /पश्चिम/मुं.झो.सु.मंडळ",
      closing: "07 October 2026",
      closingOn: "2026-10-07",
      documents: [
        "https://www.mhada.gov.in/sites/default/files/TN_No_134-EE-West-MSIB-30-09-2026.pdf",
      ],
    });
    for (const row of rows) expect(row.documents.length).toBeGreaterThan(0);
  });

  it("reads the oldest page, whose references carry the GePNIC tender-ID shape", () => {
    const { rows } = parseMhadaListing(fixture("mhada-tenders-page454-2026-09-30.html"));
    expect(rows).toHaveLength(7);
    const last = rows.at(-1);
    expect(last?.serial).toBe("4547");
    expect(last?.publishedOn).toBe("2016-07-25");
    expect(last?.reference).toBe("२०१६-म्हाडा-१४०५८०-१");
    // A space in the file name is encoded, not dropped.
    expect(last?.documents[0]).toContain("Corrigendum%20final");
  });

  it("records listing facts as printed", () => {
    const { rows } = parseMhadaListing(fixture("mhada-tenders-page0-2026-09-30.html"));
    const first = rows[0];
    if (first === undefined) throw new Error("no rows");
    expect(listingFactsOf(first)).toMatchObject({
      published: "30 September 2026",
      published_on: "2026-09-30",
      board: "मुंबई झोपडपट्टी सुधार मंडळ",
    });
    expect(listingFactsOf({ ...first, reference: "" })["reference"]).toBeNull();
  });

  it("refuses a page it does not understand, rather than reading it as no notices", () => {
    expect(() => parseMhadaListing("<html><body>Maintenance</body></html>")).toThrow(
      ListingNotUnderstood,
    );
    const noRows = fixture("mhada-tenders-page0-2026-09-30.html").replace(
      /<tbody>[\s\S]*<\/tbody>/u,
      "<tbody></tbody>",
    );
    expect(() => parseMhadaListing(noRows)).toThrow(/no rows/u);
  });

  it("builds page URLs as MHADA's pager does", () => {
    expect(listingPageUrl(0)).toBe("https://www.mhada.gov.in/mr/tenders");
    expect(listingPageUrl(454)).toBe("https://www.mhada.gov.in/mr/tenders?page=454");
  });
});

describe("dates are read only when written unambiguously", () => {
  it.each([
    ["30 September 2026", "2026-09-30"],
    ["07 October 2026", "2026-10-07"],
    ["25 July 2016", "2016-07-25"],
  ])("%s → %s", (printed, iso) => {
    expect(isoDateOf(printed)).toBe(iso);
  });

  it.each(["31 September 2026", "08-03-2023", "September 30 2026", "", "30 Sept 2026"])(
    "%j is left unread",
    (printed) => {
      expect(isoDateOf(printed)).toBeNull();
    },
  );
});

describe("the polite client", () => {
  type Page = () => Response;

  function fakeHost(pages: Readonly<Record<string, Page>>): {
    readonly http: (url: string, init: HttpInit) => Promise<Response>;
    readonly requested: string[];
    readonly headers: Headers[];
  } {
    const requested: string[] = [];
    const headers: Headers[] = [];
    return {
      requested,
      headers,
      http: (url, init) => {
        const parsed = new URL(url);
        requested.push(parsed.pathname + parsed.search);
        headers.push(new Headers(init.headers));
        const page = pages[parsed.pathname];
        return Promise.resolve(page === undefined ? new Response("", { status: 404 }) : page());
      },
    };
  }

  function clock(): {
    readonly now: () => number;
    readonly sleep: (ms: number) => Promise<void>;
  } {
    let now = 1_000;
    return {
      now: () => now,
      sleep: (ms) => {
        now += ms;
        return Promise.resolve();
      },
    };
  }

  it("reads robots.txt once, and never requests a path it refuses", async () => {
    const host = fakeHost({
      "/robots.txt": () =>
        new Response("User-agent: *\nDisallow: /search/\n", {
          headers: { "content-type": "text/plain" },
        }),
      "/mr/tenders": () => new Response("<html></html>"),
    });
    const client = new PoliteClient({ http: host.http, ...clock() });

    await client.get("https://example.gov.in/mr/tenders", AGENCY_PAGE);
    await expect(
      client.get("https://example.gov.in/search/node?keys=x", AGENCY_PAGE),
    ).rejects.toBeInstanceOf(PathNotPermitted);
    await client.get("https://example.gov.in/mr/tenders?page=1", AGENCY_PAGE);

    expect(host.requested).toEqual(["/robots.txt", "/mr/tenders", "/mr/tenders?page=1"]);
  });

  it("spaces requests to one host at least the interval apart", async () => {
    const host = fakeHost({
      "/robots.txt": () => new Response("", { status: 404 }),
      "/a": () => new Response("a"),
    });
    const time = clock();
    const startedAt: number[] = [];
    const client = new PoliteClient({
      minIntervalMs: 2_000,
      ...time,
      http: (url, init) => {
        startedAt.push(time.now());
        return host.http(url, init);
      },
    });
    await Promise.all([
      client.get("https://example.gov.in/a", AGENCY_PAGE),
      client.get("https://example.gov.in/a", AGENCY_PAGE),
    ]);
    // robots.txt, then two pages: each at least two seconds after the one before.
    expect(startedAt).toHaveLength(3);
    for (let i = 1; i < startedAt.length; i += 1) {
      expect((startedAt[i] ?? 0) - (startedAt[i - 1] ?? 0)).toBeGreaterThanOrEqual(2_000);
    }
  });

  it("refuses a whole host whose robots.txt is an HTML page", async () => {
    const host = fakeHost({
      "/robots.txt": () =>
        new Response("<!DOCTYPE html><html></html>", {
          headers: { "content-type": "text/html" },
        }),
    });
    const client = new PoliteClient({ http: host.http, ...clock() });
    await expect(client.get("https://example.gov.in/tenders", AGENCY_PAGE)).rejects.toBeInstanceOf(
      PathNotPermitted,
    );
    expect(host.requested).toEqual(["/robots.txt"]);
  });

  it("identifies itself and sends validators from an earlier sighting", async () => {
    const host = fakeHost({
      "/robots.txt": () => new Response("", { status: 404 }),
      "/n.pdf": () => new Response(null, { status: 304 }),
    });
    const client = new PoliteClient({ http: host.http, ...clock() });
    const result = await client.get("https://example.gov.in/n.pdf", AGENCY_PAGE, {
      etag: '"abc"',
      lastModified: "Wed, 30 Sep 2026 10:00:00 GMT",
    });
    expect(result.status).toBe(304);
    const sent = host.headers[1];
    expect(sent?.get("if-none-match")).toBe('"abc"');
    expect(sent?.get("if-modified-since")).toBe("Wed, 30 Sep 2026 10:00:00 GMT");
    expect(sent?.get("user-agent")).toMatch(/^LokDarpan\//u);
  });
});
