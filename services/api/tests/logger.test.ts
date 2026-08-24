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
