import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const submitCorrection = vi.fn();
vi.mock("@/server/intake", () => ({ submitCorrection }));

const originLimited = vi.fn(() => Promise.resolve(false));
vi.mock("@/server/rate-limit", () => ({ originLimited }));

const { POST } = await import("./route");

const SITE = "https://lokdarpan.example.invalid";

const valid = {
  subject: "fact:123",
  category: "amount_wrong",
  description: "Page 12 prints 4.5 crore, not 45 crore.",
  evidenceUrl: "",
};

const form = (fields: Record<string, string>, origin: string | null = SITE): Request =>
  new Request(`${SITE}/api/v1/corrections`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(origin === null ? {} : { origin }),
    },
    body: new URLSearchParams(fields).toString(),
  });

const json = (body: unknown): Request =>
  new Request(`${SITE}/api/v1/corrections`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: SITE },
    body: JSON.stringify(body),
  });

describe("POST /api/v1/corrections", () => {
  beforeEach(() => {
    submitCorrection.mockReset();
    originLimited.mockReset();
    originLimited.mockResolvedValue(false);
  });

  it("stores a valid form report and sends the reader to their reference", async () => {
    submitCorrection.mockResolvedValue({ kind: "received", reference: "LD-0123456789" });
    const r = await POST(form(valid));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/report/received?ref=LD-0123456789");
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(submitCorrection).toHaveBeenCalledWith({
      subject: "fact:123",
      category: "amount_wrong",
      description: valid.description,
      evidenceUrl: null,
    });
  });

  it("answers a JSON report with JSON", async () => {
    submitCorrection.mockResolvedValue({ kind: "received", reference: "LD-0123456789" });
    const r = await POST(json(valid));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ data: { reference: "LD-0123456789" } });
  });

  it("refuses a post from another site, or with no origin, before reading it", async () => {
    expect((await POST(form(valid, "https://elsewhere.example"))).status).toBe(403);
    expect((await POST(form(valid, null))).status).toBe(403);
    expect(submitCorrection).not.toHaveBeenCalled();
  });

  it("sends the reader back with every problem named, keeping what the report is about", async () => {
    const r = await POST(form({ ...valid, description: "short", category: "fraud" }));
    expect(r.status).toBe(303);
    const location = new URL(r.headers.get("location") ?? "", SITE);
    expect(location.pathname).toBe("/report");
    expect(location.searchParams.get("error")).toBe("category,description_short");
    expect(location.searchParams.get("subject")).toBe("fact:123");
    expect(submitCorrection).not.toHaveBeenCalled();
  });

  it("tells a script that filled the hidden field nothing, and stores nothing", async () => {
    const r = await POST(form({ ...valid, website: "http://spam.example" }));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/report/received");
    expect(submitCorrection).not.toHaveBeenCalled();
  });

  it("refuses when the connection is over its limit, before touching the database", async () => {
    originLimited.mockResolvedValue(true);
    const r = await POST(json(valid));
    expect(r.status).toBe(429);
    expect(submitCorrection).not.toHaveBeenCalled();
  });

  it("refuses a body far larger than any report", async () => {
    const r = await POST(
      new Request(`${SITE}/api/v1/corrections`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: SITE, "content-length": "20000" },
        body: JSON.stringify(valid),
      }),
    );
    expect(r.status).toBe(413);
  });

  it("refuses a body it cannot read", async () => {
    const r = await POST(
      new Request(`${SITE}/api/v1/corrections`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: SITE },
        body: "{not json",
      }),
    );
    expect(r.status).toBe(400);
  });

  it.each([
    ["paused", 503, "PAUSED"],
    ["unavailable", 503, "UNAVAILABLE"],
  ] as const)("says so plainly when intake is %s", async (kind, status, code) => {
    submitCorrection.mockResolvedValue({ kind });
    const r = await POST(json(valid));
    expect(r.status).toBe(status);
    expect(await r.json()).toMatchObject({ error: { code } });
    const f = await POST(form(valid));
    expect(f.headers.get("location")).toBe(`/report?error=${code}`);
  });
});
