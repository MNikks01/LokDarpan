import { describe, expect, it } from "vitest";

import { scrubSecrets, scrubValue } from "../src/scrub.js";

describe("scrubSecrets", () => {
  // The case that motivated this: a driver error message, written by an
  // exception handler rather than by anyone choosing to log a secret.
  it("removes the password from a connection string in an error message", () => {
    const line =
      "connect ECONNREFUSED postgresql://lokdarpan:PLACEHOLDER-PW@db.internal:5432/lokdarpan";
    const scrubbed = scrubSecrets(line);
    expect(scrubbed).not.toContain("PLACEHOLDER-PW");
    expect(scrubbed).toContain("[redacted]");
  });

  it("keeps the host and user, which are needed to diagnose and are not secrets", () => {
    const scrubbed = scrubSecrets("postgresql://lokdarpan:pw@db.internal:5432/lokdarpan");
    expect(scrubbed).toContain("db.internal");
    expect(scrubbed).toContain("lokdarpan");
    expect(scrubbed).not.toContain(":pw@");
  });

  it("handles any scheme, not just postgres", () => {
    for (const scheme of ["redis", "amqp", "https", "mongodb+srv"]) {
      expect(scrubSecrets(`${scheme}://user:topsecret@host/path`)).not.toContain("topsecret");
    }
  });

  // Placeholder values, deliberately low-entropy and unmistakably fake. The
  // scrubber matches on the key, never the value's shape, so a realistic-looking
  // credential would test nothing extra — and would trip the secret scanner,
  // which is a gate worth keeping sharp rather than allowlisting around.
  it("removes inline key=value secrets from free text", () => {
    for (const line of [
      "DATABASE_URL=postgres://u:PLACEHOLDER-PW@h/db failed",
      "password=PLACEHOLDER-PW",
      "password: PLACEHOLDER-PW",
      'api_key="PLACEHOLDER-API-KEY"',
      "token: PLACEHOLDER.TOKEN.VALUE",
      "secret=PLACEHOLDER-SECRET",
      "AWS_ACCESS_KEY=PLACEHOLDER-ACCESS-KEY",
    ]) {
      const scrubbed = scrubSecrets(line);
      for (const leak of [
        "PLACEHOLDER-PW",
        "PLACEHOLDER-API-KEY",
        "PLACEHOLDER.TOKEN.VALUE",
        "PLACEHOLDER-SECRET",
        "PLACEHOLDER-ACCESS-KEY",
      ]) {
        expect(scrubbed, `"${line}" must not leak "${leak}"`).not.toContain(leak);
      }
    }
  });

  it("removes bearer and basic credentials", () => {
    expect(scrubSecrets("Authorization: Bearer PLACEHOLDER-BEARER-TOKEN")).not.toContain(
      "PLACEHOLDER-BEARER-TOKEN",
    );
    expect(scrubSecrets("authorization: Basic PLACEHOLDER-BASIC-CREDS")).not.toContain(
      "PLACEHOLDER-BASIC-CREDS",
    );
  });

  // Over-redaction destroys the diagnostic value the log exists for.
  it("leaves ordinary operational text alone", () => {
    for (const line of [
      "request.completed status=200 route=/api/v1/units/:id ms=42",
      "loaded inserted=36 updated=0 unchanged=0",
      "LGD state table contained no data rows",
      "Maharashtra महाराष्ट्र LGD 27",
    ]) {
      expect(scrubSecrets(line)).toBe(line);
    }
  });

  it("is idempotent", () => {
    const once = scrubSecrets("password=PLACEHOLDER-PW");
    expect(scrubSecrets(once)).toBe(once);
  });
});

describe("scrubValue", () => {
  it("scrubs strings and passes other values through untouched", () => {
    expect(scrubValue("password=PLACEHOLDER-PW")).not.toContain("PLACEHOLDER-PW");
    expect(scrubValue(42)).toBe(42);
    expect(scrubValue(true)).toBe(true);
    expect(scrubValue(null)).toBeNull();
    expect(scrubValue(undefined)).toBeUndefined();
  });
});
