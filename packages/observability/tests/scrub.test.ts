import { describe, expect, it } from "vitest";

import { scrubSecrets, scrubValue } from "../src/scrub.js";

describe("scrubSecrets", () => {
  // The case that motivated this: a driver error message, written by an
  // exception handler rather than by anyone choosing to log a secret.
  it("removes the password from a connection string in an error message", () => {
    const line =
      "connect ECONNREFUSED postgresql://lokdarpan:s3cr3t-prod-pw@db.internal:5432/lokdarpan";
    const scrubbed = scrubSecrets(line);
    expect(scrubbed).not.toContain("s3cr3t-prod-pw");
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

  it("removes inline key=value secrets from free text", () => {
    for (const line of [
      "DATABASE_URL=postgres://u:hunter2@h/db failed",
      "password=hunter2",
      "password: hunter2",
      'api_key="AIzaSyD1234567890"',
      "token: abc.def.ghi",
      "secret=shhh",
      "AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE",
    ]) {
      const scrubbed = scrubSecrets(line);
      for (const leak of [
        "hunter2",
        "AIzaSyD1234567890",
        "abc.def.ghi",
        "shhh",
        "AKIAIOSFODNN7EXAMPLE",
      ]) {
        expect(scrubbed, `"${line}" must not leak "${leak}"`).not.toContain(leak);
      }
    }
  });

  it("removes bearer and basic credentials", () => {
    expect(scrubSecrets("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abcdefghij")).not.toContain(
      "eyJhbGciOiJIUzI1NiJ9",
    );
    expect(scrubSecrets("authorization: Basic dXNlcjpwYXNzd29yZA==")).not.toContain(
      "dXNlcjpwYXNzd29yZA",
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
    const once = scrubSecrets("password=hunter2");
    expect(scrubSecrets(once)).toBe(once);
  });
});

describe("scrubValue", () => {
  it("scrubs strings and passes other values through untouched", () => {
    expect(scrubValue("password=hunter2")).not.toContain("hunter2");
    expect(scrubValue(42)).toBe(42);
    expect(scrubValue(true)).toBe(true);
    expect(scrubValue(null)).toBeNull();
    expect(scrubValue(undefined)).toBeUndefined();
  });
});
