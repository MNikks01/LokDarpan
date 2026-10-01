import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { INTERNAL_HEADER, ORIGIN_RATE_LIMIT_ID, isInternal, originLimited } =
  await import("./rate-limit");

const TOKEN = "t".repeat(40);

const request = (headers: Record<string, string> = {}): Request =>
  new Request("https://lokdarpan.example.invalid/api/v1/search?q=nagpur", { headers });

type Check = Parameters<typeof originLimited>[1];
const answering =
  (result: { rateLimited: boolean; error?: "not-found" | "blocked" }): NonNullable<Check> =>
  () =>
    Promise.resolve(result);

describe("isInternal: which requests are our own pages", () => {
  it("recognises the server's token", () => {
    expect(isInternal(request({ [INTERNAL_HEADER]: TOKEN }), TOKEN)).toBe(true);
  });

  it("refuses a wrong or missing token", () => {
    expect(isInternal(request({ [INTERNAL_HEADER]: "x".repeat(40) }), TOKEN)).toBe(false);
    expect(isInternal(request(), TOKEN)).toBe(false);
  });

  // With no secret configured, a header of the right name must exempt nobody —
  // an empty value would otherwise match an empty secret.
  it("exempts nobody when no token is configured, or it is too short to be a secret", () => {
    expect(isInternal(request({ [INTERNAL_HEADER]: "" }), undefined)).toBe(false);
    expect(isInternal(request({ [INTERNAL_HEADER]: "" }), "")).toBe(false);
    expect(isInternal(request({ [INTERNAL_HEADER]: "short" }), "short")).toBe(false);
  });
});

describe("originLimited", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("asks the Firewall rule by its name, and limits when told to", async () => {
    const check = vi.fn(answering({ rateLimited: true }));
    await expect(originLimited(request(), check)).resolves.toBe(true);
    expect(check).toHaveBeenCalledWith(ORIGIN_RATE_LIMIT_ID, expect.anything());
  });

  it("lets a client under the limit through", async () => {
    await expect(originLimited(request(), answering({ rateLimited: false }))).resolves.toBe(false);
  });

  it("never counts our own pages against the reader's bucket", async () => {
    vi.stubEnv("INTERNAL_API_TOKEN", TOKEN);
    const check = vi.fn(answering({ rateLimited: true }));
    await expect(originLimited(request({ [INTERNAL_HEADER]: TOKEN }), check)).resolves.toBe(false);
    expect(check).not.toHaveBeenCalled();
  });

  // Shipped before the rule exists, it must change nothing — and say so.
  it("fails open, and logs, when the rule is not configured", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await expect(
      originLimited(request(), answering({ rateLimited: false, error: "not-found" })),
    ).resolves.toBe(false);
    expect(String(write.mock.calls[0]?.[0])).toContain("rate_limit.rule_missing");
  });

  // A limiter outage must not become a site outage.
  it("fails open, and logs, when the check itself fails", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const broken: NonNullable<Check> = () => Promise.reject(new Error("status 502"));
    await expect(originLimited(request(), broken)).resolves.toBe(false);
    expect(String(write.mock.calls[0]?.[0])).toContain("rate_limit.check_failed");
  });
});
