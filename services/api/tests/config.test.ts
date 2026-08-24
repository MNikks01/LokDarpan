import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config/index.js";

describe("configuration fails fast", () => {
  it("loads valid config with defaults", () => {
    const c = loadConfig({ NODE_ENV: "test" });
    expect(c.port).toBe(4000);
    expect(c.nodeEnv).toBe("test");
  });

  it("rejects an out-of-range port rather than starting", () => {
    expect(() => loadConfig({ NODE_ENV: "test", PORT: "70000" })).toThrow(ConfigError);
    expect(() => loadConfig({ NODE_ENV: "test", PORT: "-1" })).toThrow(ConfigError);
  });

  it("accepts port 0, which means bind an ephemeral port", () => {
    expect(loadConfig({ NODE_ENV: "test", PORT: "0" }).port).toBe(0);
  });

  it("rejects an unknown log level", () => {
    expect(() => loadConfig({ NODE_ENV: "test", LOG_LEVEL: "verbose" })).toThrow(ConfigError);
  });

  it("reports every problem at once, not one per restart", () => {
    try {
      loadConfig({ NODE_ENV: "nope", PORT: "70000", LOG_LEVEL: "loud" });
      expect.unreachable("should have thrown");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("nodeEnv");
      expect(msg).toContain("port");
      expect(msg).toContain("logLevel");
    }
  });

  it("returns a frozen object", () => {
    const c = loadConfig({ NODE_ENV: "test" });
    expect(Object.isFrozen(c)).toBe(true);
  });
});
