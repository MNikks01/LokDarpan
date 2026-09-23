import { afterEach, describe, expect, it } from "vitest";

import { tenderDetailsArePublishable, treasuryFiguresArePublishable } from "./publishable";

/**
 * BEAMS permits reproduction "after taking proper permission by sending a mail
 * to us". Permission has not been sought, so its figures are not rendered.
 *
 * The default matters more than the flag. A deployment that forgets to set
 * anything must withhold, because the failure that costs something is
 * publishing figures a source did not permit — not hiding figures it did.
 */

afterEach(() => {
  delete process.env["PUBLISH_BEAMS_FIGURES"];
  delete process.env["PUBLISH_TENDER_DETAILS"];
});

describe("treasury figures are withheld unless permission is recorded", () => {
  it("withholds when nothing is configured", () => {
    delete process.env["PUBLISH_BEAMS_FIGURES"];
    expect(treasuryFiguresArePublishable()).toBe(false);
  });

  it.each(["", "false", "0", "no", "TRUE", "True", "yes", "1"])(
    "withholds for the ambiguous value %o",
    (value) => {
      // Only the exact string "true" opens this. A truthiness test would let
      // "false" through, which is how a flag meant to protect something ends up
      // publishing it.
      process.env["PUBLISH_BEAMS_FIGURES"] = value;
      expect(treasuryFiguresArePublishable()).toBe(false);
    },
  );

  it("publishes only when explicitly told to", () => {
    process.env["PUBLISH_BEAMS_FIGURES"] = "true";
    expect(treasuryFiguresArePublishable()).toBe(true);
  });

  it("is read at call time, not frozen at import", () => {
    // The day permission arrives this must become true without a rebuild.
    delete process.env["PUBLISH_BEAMS_FIGURES"];
    expect(treasuryFiguresArePublishable()).toBe(false);
    process.env["PUBLISH_BEAMS_FIGURES"] = "true";
    expect(treasuryFiguresArePublishable()).toBe(true);
  });
});

/**
 * Every collected tender portal permits reproduction only with the issuing
 * department's permission, which has not been sought. Same default, same strict
 * reading, and independent of the treasury flag.
 */
describe("tender details are withheld unless permission is recorded", () => {
  it("withholds when nothing is configured", () => {
    expect(tenderDetailsArePublishable()).toBe(false);
  });

  it.each(["", "false", "1", "TRUE", "yes"])("withholds for the ambiguous value %o", (value) => {
    process.env["PUBLISH_TENDER_DETAILS"] = value;
    expect(tenderDetailsArePublishable()).toBe(false);
  });

  it("publishes only when explicitly told to, and reads the flag at call time", () => {
    expect(tenderDetailsArePublishable()).toBe(false);
    process.env["PUBLISH_TENDER_DETAILS"] = "true";
    expect(tenderDetailsArePublishable()).toBe(true);
  });

  it("is not opened by the treasury flag", () => {
    process.env["PUBLISH_BEAMS_FIGURES"] = "true";
    expect(tenderDetailsArePublishable()).toBe(false);
  });
});
