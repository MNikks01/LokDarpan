import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The permission registry is a record of what was actually asked of whom, and
 * what they said. These checks keep it from becoming a record of intentions:
 * a request cannot be marked sent without the date and reference of the
 * request, a response cannot exist without one, and a pending request cannot
 * carry a date nobody recorded.
 */
const DIR = fileURLToPath(new URL("../../../.docs/06-government-sources/", import.meta.url));

interface Entry {
  readonly id: string;
  readonly department: string;
  readonly dataset: string;
  readonly access_method: string;
  readonly restrictions: string;
  readonly request: {
    readonly status: string;
    readonly date: string | null;
    readonly reference: string | null;
    readonly channel: string | null;
    readonly draft: string | null;
  };
  readonly response: { readonly date: string | null; readonly summary: string | null };
  readonly last_verified: string;
  readonly evidence: string;
}

const registry = JSON.parse(readFileSync(`${DIR}permission-requests.json`, "utf8")) as {
  readonly requests: readonly Entry[];
};

const PENDING = new Set(["not_sent", "draft_ready", "credential_needed", "not_required"]);
const SENT = new Set(["sent", "acknowledged", "granted", "refused"]);
const ANSWERED = new Set(["acknowledged", "granted", "refused"]);
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

describe("the permission registry", () => {
  it("has one entry per id, each naming who, what, how and on what terms", () => {
    const ids = registry.requests.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of registry.requests) {
      for (const field of ["department", "dataset", "access_method", "restrictions"] as const) {
        expect(r[field].trim(), `${r.id}.${field}`).not.toBe("");
      }
      expect(r.last_verified, `${r.id}.last_verified`).toMatch(DATE);
      expect(existsSync(`${DIR}${r.evidence}`), `${r.id}.evidence ${r.evidence}`).toBe(true);
    }
  });

  it("records a request as sent only with its date and reference", () => {
    for (const r of registry.requests) {
      const { status, date, reference } = r.request;
      expect(PENDING.has(status) || SENT.has(status), `${r.id}: unknown status ${status}`).toBe(
        true,
      );
      if (SENT.has(status)) {
        expect(date, `${r.id}.request.date`).toMatch(DATE);
        expect(reference?.trim() ?? "", `${r.id}.request.reference`).not.toBe("");
      } else {
        // A pending request has no date: one would claim a letter nobody sent.
        expect(date, `${r.id}.request.date`).toBeNull();
        expect(reference, `${r.id}.request.reference`).toBeNull();
      }
    }
  });

  it("holds a response only for a request that was answered", () => {
    for (const r of registry.requests) {
      if (ANSWERED.has(r.request.status)) {
        expect(r.response.date, `${r.id}.response.date`).toMatch(DATE);
        expect(r.response.summary?.trim() ?? "", `${r.id}.response.summary`).not.toBe("");
      } else {
        expect(r.response, `${r.id}.response`).toEqual({ date: null, summary: null });
      }
    }
  });

  it("points at a draft that exists", () => {
    for (const r of registry.requests) {
      if (r.request.draft === null) continue;
      expect(existsSync(`${DIR}${r.request.draft}`), `${r.id}.draft ${r.request.draft}`).toBe(true);
    }
  });
});
