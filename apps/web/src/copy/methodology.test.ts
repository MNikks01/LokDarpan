import { sourceLicences } from "@lokdarpan/domain";
import { describe, expect, it } from "vitest";

import { methodFor, methodologyCopy } from "./methodology";

/**
 * A source is explained before it is shown (LD-005). The methodology page lists
 * sources from the licence registry, so a registered source with no entry here
 * would appear with its terms and no account of what is taken from it.
 */
describe("the methodology page's sources", () => {
  it("has an entry for every source in the licence registry", () => {
    for (const licence of sourceLicences()) {
      expect(methodFor(licence.sourceId), licence.sourceId).toBeDefined();
    }
  });

  it("has no entry for a source the registry does not hold", () => {
    const registered = new Set(sourceLicences().map((l) => l.sourceId));
    for (const id of Object.keys(methodologyCopy.sources)) {
      expect(registered.has(id), id).toBe(true);
    }
  });

  it("says plainly what a reader sees of each source", () => {
    for (const licence of sourceLicences()) {
      const shown = methodFor(licence.sourceId)?.shown ?? "";
      expect(shown, licence.sourceId).toMatch(/^(Shown|Not shown)/u);
      if (licence.republication !== "permitted") {
        // A source whose terms do not permit reproduction cannot be described
        // as shown without saying what is held back.
        expect(shown, licence.sourceId).toMatch(/not shown|Not shown/u);
      }
    }
  });
});
