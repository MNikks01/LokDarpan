import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const search = vi.fn(() => Promise.resolve([]));
vi.mock("@/server/container", () => ({
  inLedger: (read: (repos: { geography: { search: typeof search } }) => unknown) =>
    Promise.resolve(read({ geography: { search } })).then((data) => ({ data, datasetVersion: 1 })),
  datasetVersionOpenedAt: () => Promise.resolve(null),
}));

const { GET } = await import("./route");

const get = (q: string): Promise<Response> =>
  GET(new Request(`https://lokdarpan.example.invalid/api/v1/search?q=${encodeURIComponent(q)}`));

describe("GET /api/v1/search", () => {
  beforeEach(() => {
    search.mockClear();
  });

  it("passes the reader's term to search, with a cap per kind", async () => {
    const response = await get("Nagpur");
    expect(response.status).toBe(200);
    expect(search).toHaveBeenCalledWith("Nagpur", 8);
  });

  // Every character of a term reaches a full-text query; one no reader would
  // type is refused before it does.
  it("refuses a term longer than any a reader types, without touching the database", async () => {
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const response = await get("x".repeat(101));
    expect(response.status).toBe(400);
    expect(search).not.toHaveBeenCalled();
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe("BAD_REQUEST");
  });
});
