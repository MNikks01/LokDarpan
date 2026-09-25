import type { SqlClient } from "@lokdarpan/database";
import { describe, expect, it } from "vitest";

import {
  claimedAmountsByPage,
  factById,
  pageKeyOf,
  pendingReview,
  reviewProgress,
} from "../src/review/queue";

/** Records each statement and answers with the given rows. */
function fake(rows: unknown[]): {
  readonly client: SqlClient;
  readonly calls: { sql: string; values: readonly unknown[] }[];
} {
  const calls: { sql: string; values: readonly unknown[] }[] = [];
  return {
    calls,
    client: {
      query: (sql, values = []) => {
        calls.push({ sql, values });
        return Promise.resolve({ rows });
      },
    },
  };
}

const ROW = {
  id: "41",
  document_id: "7",
  page_number: 12,
  kind: "monetary_amount",
  raw_text: "₹ 12.40 crore",
  normalised_value: "12400000000",
  extraction_confidence: "0.8200",
  parser_version: "cag-facts/3",
  document_title: "Report No. 4 of 2025",
  source_url: "https://cag.example.invalid/r4.pdf",
};

describe("the review queue", () => {
  it("offers only undecided facts, with the default page size", async () => {
    const { client, calls } = fake([ROW]);
    const [candidate] = await pendingReview(client);
    expect(calls[0]?.sql).toContain("f.verification_status = 'unverified'");
    expect(calls[0]?.values).toEqual([500]);
    // Numbers arrive from Postgres as text and leave as numbers.
    expect(candidate).toMatchObject({
      id: 41,
      documentId: 7,
      pageNumber: 12,
      extractionConfidence: 0.82,
      normalisedValue: "12400000000",
    });
  });

  it("numbers each filter's placeholder in the order it was added", async () => {
    const { client, calls } = fake([]);
    await pendingReview(client, {
      kind: "monetary_amount",
      documentId: 7,
      ids: [41, 42],
      minConfidence: 0.5,
      limit: 2,
    });
    const sql = calls[0]?.sql ?? "";
    expect(sql).toContain("f.kind = $1");
    expect(sql).toContain("f.document_id = $2");
    expect(sql).toContain("f.id = ANY($3::bigint[])");
    expect(sql).toContain("f.extraction_confidence >= $4");
    expect(sql).toContain("LIMIT $5");
    expect(calls[0]?.values).toEqual(["monetary_amount", 7, [41, 42], 0.5, 2]);
  });
});

describe("amounts claimed on each page", () => {
  it("groups every claimed amount by page, decided or not", async () => {
    const { client, calls } = fake([
      { document_id: "7", page_number: 12, normalised_value: "100" },
      { document_id: "7", page_number: 12, normalised_value: "200" },
      { document_id: "7", page_number: 13, normalised_value: "100" },
    ]);
    const claimed = await claimedAmountsByPage(client);
    expect(calls[0]?.sql).not.toContain("verification_status");
    expect([...(claimed.get(pageKeyOf(7, 12)) ?? [])]).toEqual(["100", "200"]);
    expect([...(claimed.get(pageKeyOf(7, 13)) ?? [])]).toEqual(["100"]);
  });

  it("scopes to one document when asked", async () => {
    const { client, calls } = fake([]);
    await claimedAmountsByPage(client, { documentId: 9 });
    expect(calls[0]?.sql).toContain("AND document_id = $1");
    expect(calls[0]?.values).toEqual([9]);
  });
});

describe("progress through the queue", () => {
  it("counts every status, reading one that has no rows as zero", async () => {
    const { client } = fake([
      { status: "unverified", n: 3 },
      { status: "verified", n: 5 },
    ]);
    expect(await reviewProgress(client)).toEqual({
      unverified: 3,
      verified: 5,
      rejected: 0,
      corrected: 0,
    });
  });
});

describe("revising a decision", () => {
  it("reads back a decided fact", async () => {
    const { client, calls } = fake([ROW]);
    expect((await factById(client, 41))?.id).toBe(41);
    // Revision cannot become a way to make a first decision outside the queue.
    expect(calls[0]?.sql).toContain("f.verification_status <> 'unverified'");
    expect(calls[0]?.values).toEqual([41]);
  });

  it("finds nothing for a fact not yet decided", async () => {
    const { client } = fake([]);
    expect(await factById(client, 41)).toBeNull();
  });
});
