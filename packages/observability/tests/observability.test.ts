import { describe, expect, it } from "vitest";

import { bucketBytes, bucketCount, bucketLatency } from "../src/buckets";
import { MetricsRegistry } from "../src/metrics";
import { routePattern } from "../src/route-pattern";

describe("bucketing", () => {
  it("buckets latency at the boundaries the spec names", () => {
    expect(bucketLatency(0)).toBe("<300ms");
    expect(bucketLatency(299)).toBe("<300ms");
    expect(bucketLatency(300)).toBe("<1s");
    expect(bucketLatency(999)).toBe("<1s");
    expect(bucketLatency(1_000)).toBe("<3s");
    expect(bucketLatency(2_999)).toBe("<3s");
    expect(bucketLatency(3_000)).toBe("<8s");
    expect(bucketLatency(7_999)).toBe("<8s");
    expect(bucketLatency(8_000)).toBe("8s+");
  });

  it("treats a nonsensical duration as the worst bucket, not the best", () => {
    expect(bucketLatency(Number.NaN)).toBe("8s+");
    expect(bucketLatency(-1)).toBe("8s+");
  });

  it("buckets counts and bytes", () => {
    expect([0, 1, 3, 4, 10, 11, 50, 51].map(bucketCount)).toEqual([
      "0",
      "1-3",
      "1-3",
      "4-10",
      "4-10",
      "11-50",
      "11-50",
      "51+",
    ]);
    expect([0, 999_999, 1_000_000, 10_000_000].map(bucketBytes)).toEqual([
      "<100KB",
      "<1MB",
      "<10MB",
      "10MB+",
    ]);
  });
});

describe("routePattern", () => {
  // The whole point: an id must never reach telemetry.
  it("replaces the entity id with a placeholder", () => {
    expect(routePattern("/api/v1/units/20")).toBe("/api/v1/units/:id");
    expect(routePattern("/api/v1/units/677367")).toBe("/api/v1/units/:id");
    expect(routePattern("/api/v1/projects/501")).toBe("/api/v1/projects/:id");
  });

  it("keeps collection and operational routes as themselves", () => {
    expect(routePattern("/api/v1/units")).toBe("/api/v1/units");
    expect(routePattern("/livez")).toBe("/livez");
    expect(routePattern("/metrics")).toBe("/metrics");
  });

  // A route added later must not start leaking identifiers merely because
  // nobody remembered to update the allowlist.
  it("collapses an unknown path rather than passing it through", () => {
    expect(routePattern("/api/v1/contractors/ACME-LTD")).toBe("other");
    expect(routePattern("/api/v1/search?q=irrigation+scam")).toBe("other");
    expect(routePattern("/../../etc/passwd")).toBe("other");
  });
});

describe("MetricsRegistry", () => {
  it("counts requests by route pattern and status", () => {
    const registry = new MetricsRegistry();
    registry.recordRequest("/api/v1/units/20", 200, 120);
    registry.recordRequest("/api/v1/units/21", 200, 120);
    registry.recordRequest("/api/v1/units/99", 404, 5);

    const output = registry.render();
    expect(output).toContain(
      'lokdarpan_http_requests_total{route="/api/v1/units/:id",status="200"} 2',
    );
    expect(output).toContain(
      'lokdarpan_http_requests_total{route="/api/v1/units/:id",status="404"} 1',
    );
  });

  it("never publishes the id that was requested", () => {
    const registry = new MetricsRegistry();
    registry.recordRequest("/api/v1/units/20", 200, 10);
    registry.recordRequest("/api/v1/projects/501", 200, 10);

    const output = registry.render();
    expect(output).not.toMatch(/\b20\b(?!0)/u);
    expect(output).not.toContain("501");
  });

  it("records latency as a bucket, never as a duration", () => {
    const registry = new MetricsRegistry();
    registry.recordRequest("/api/v1/units", 200, 1_234);
    const output = registry.render();
    expect(output).toContain('bucket="<3s"');
    expect(output).not.toContain("1234");
  });

  // Free text as a label is how query strings and entity names end up on a
  // scrape endpoint. The registry refuses rather than trusting callers.
  it("refuses a label value that is not bucketed or enumerated", () => {
    const registry = new MetricsRegistry();
    expect(() => {
      registry.increment("x", "h", { q: "irrigation project pune" });
    }).toThrow(/not a permitted value/i);
    expect(() => {
      registry.increment("x", "h", { name: "Maharashtra Public Works" });
    }).toThrow();
    expect(() => {
      registry.increment("x", "h", { token: "Bearer abc.def" });
    }).toThrow();
  });

  it("accepts bucketed and enumerated values", () => {
    const registry = new MetricsRegistry();
    expect(() => {
      registry.increment("x", "h", { bucket: "<300ms", route: "/api/v1/units/:id", status: "200" });
    }).not.toThrow();
  });

  it("counts contract violations as an integrity alarm", () => {
    const registry = new MetricsRegistry();
    registry.recordContractViolation("mixed_dataset_version");
    registry.recordContractViolation("mixed_dataset_version");
    expect(registry.render()).toContain(
      'lokdarpan_contract_violation_total{kind="mixed_dataset_version"} 2',
    );
  });

  it("renders valid Prometheus exposition with HELP and TYPE", () => {
    const registry = new MetricsRegistry();
    registry.recordRequest("/livez", 200, 1);
    const lines = registry.render().trim().split("\n");
    expect(lines.filter((l) => l.startsWith("# HELP")).length).toBeGreaterThan(0);
    expect(lines.filter((l) => l.startsWith("# TYPE")).length).toBeGreaterThan(0);
    for (const line of lines.filter((l) => !l.startsWith("#"))) {
      expect(line).toMatch(/^[a-z_]+(\{.*\})? \d+$/u);
    }
  });
});
