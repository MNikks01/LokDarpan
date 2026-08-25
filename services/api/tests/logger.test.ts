import { describe, it, expect } from "vitest";
import { StructuredLogger } from "../src/logging/logger.js";

function capture(): { lines: string[]; sink: (l: string) => void } {
  const lines: string[] = [];
  return { lines, sink: (l) => lines.push(l) };
}

describe("structured logging", () => {
  it("emits one JSON object per line", () => {
    const { lines, sink } = capture();
    new StructuredLogger("info", {}, sink).info("hello", { projectId: 501 });
    const parsed: unknown = JSON.parse(lines[0] ?? "{}");
    expect(parsed).toMatchObject({ level: "info", message: "hello", projectId: 501 });
  });

  it("respects the minimum level", () => {
    const { lines, sink } = capture();
    const log = new StructuredLogger("warn", {}, sink);
    log.debug("x");
    log.info("y");
    log.warn("z");
    expect(lines).toHaveLength(1);
  });

  it("child loggers carry correlation fields", () => {
    const { lines, sink } = capture();
    new StructuredLogger("info", {}, sink).child({ requestId: "abc" }).info("m");
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({ requestId: "abc" });
  });

  it("REDACTS anything that could leak what a user investigates", () => {
    const { lines, sink } = capture();
    new StructuredLogger("info", {}, sink).info("search", {
      q: "ABC Infra",
      question: "who got this",
      lat: 18.5,
      token: "secret",
      email: "a@b.c",
    });
    const line = lines[0] ?? "";
    expect(line).not.toContain("ABC Infra");
    expect(line).not.toContain("18.5");
    expect(line).not.toContain("secret");
    expect(line).not.toContain("a@b.c");
    expect(line.match(/\[redacted\]/g)).toHaveLength(5);
  });
});

describe("logger redaction is two-pass", () => {
  const capture = (): { lines: string[]; log: StructuredLogger } => {
    const lines: string[] = [];
    return {
      lines,
      log: new StructuredLogger("debug", { service: "api", env: "test" }, (l) => lines.push(l)),
    };
  };

  it("redacts by key name, as before", () => {
    const { lines, log } = capture();
    log.info("x", { password: "hunter2", token: "abc" });
    expect(lines[0]).not.toContain("hunter2");
    expect(lines[0]).toContain("[redacted]");
  });

  // The failure this exists for: a driver error message carrying a connection
  // string, under a key nobody would think to redact.
  it("scrubs a credential inside a value under an innocuous key", () => {
    const { lines, log } = capture();
    log.error("db.readonly_check_failed", {
      reason: "connect ECONNREFUSED postgresql://lokdarpan:s3cr3t-prod-pw@db.internal:5432/db",
    });
    expect(lines[0]).not.toContain("s3cr3t-prod-pw");
    expect(lines[0]).toContain("db.internal");
  });

  it("scrubs the message itself", () => {
    const { lines, log } = capture();
    log.error("failed: password=hunter2");
    expect(lines[0]).not.toContain("hunter2");
  });

  it("leaves ordinary context intact", () => {
    const { lines, log } = capture();
    log.info("request.completed", { status: 200, route: "/api/v1/units/:id", ms: 42 });
    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed["status"]).toBe(200);
    expect(parsed["route"]).toBe("/api/v1/units/:id");
    expect(parsed["ms"]).toBe(42);
  });

  it("emits exactly one JSON object per line, as a collector expects", () => {
    const { lines, log } = capture();
    log.info("a");
    log.warn("b", { k: "v" });
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line).not.toContain("\n");
      expect(() => JSON.parse(line) as unknown).not.toThrow();
    }
  });
});
