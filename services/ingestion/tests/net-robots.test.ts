import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  mayFetch,
  pathOf,
  patternMatches,
  readRobots,
  refusesEverything,
  type RobotsPolicy,
} from "../src/net/robots";
import { permitsCrawling } from "../src/gepnic/fetch";

const fixture = (host: string): string =>
  readFileSync(join(__dirname, "fixtures", "robots", `${host}-2026-09-30.txt`), "utf8");

/** A real policy, as its host served it on 2026-09-30. */
const policyOf = (host: string): RobotsPolicy => readRobots(fixture(host), 200, "text/plain");

describe("the Maharashtra hosts that refuse everything", () => {
  it.each(["mahatenders.gov.in", "mahapwd.gov.in"])("%s is refused, whatever the path", (host) => {
    const policy = policyOf(host);
    expect(refusesEverything(policy)).toBe(true);
    expect(mayFetch(policy, "/")).toBe(false);
    expect(mayFetch(policy, "/nit/default.asp")).toBe(false);
    expect(mayFetch(policy, "/nicgep/app")).toBe(false);
  });
});

describe("the agency hosts that refuse only some paths", () => {
  it("MHADA: tender listings and files are permitted, search is not", () => {
    const policy = policyOf("mhada.gov.in");
    expect(refusesEverything(policy)).toBe(false);
    expect(mayFetch(policy, "/mr/tenders?page=454")).toBe(true);
    expect(mayFetch(policy, "/sites/default/files/TN_No_134-EE-West-MSIB-30-09-2026.pdf")).toBe(
      true,
    );
    expect(mayFetch(policy, "/search/node?keys=tender")).toBe(false);
    expect(mayFetch(policy, "/user/login")).toBe(false);
  });

  it("MMRDA: the archive is permitted, admin and search are not", () => {
    const policy = policyOf("mmrda.maharashtra.gov.in");
    expect(mayFetch(policy, "/mr/tenders/tender-notices/archive?page=20")).toBe(true);
    expect(mayFetch(policy, "/admin/content")).toBe(false);
    expect(mayFetch(policy, "/index.php/search/")).toBe(false);
  });

  it("MSIDC and PWD: everything but WordPress admin, with admin-ajax carved back out", () => {
    for (const host of ["msidc.org", "pwd.maharashtra.gov.in"]) {
      const policy = policyOf(host);
      expect(mayFetch(policy, "/tenders/")).toBe(true);
      expect(mayFetch(policy, "/wp-admin/options.php")).toBe(false);
      expect(mayFetch(policy, "/wp-admin/admin-ajax.php")).toBe(true);
    }
  });

  it("MEDA: tender pages permitted, /search and /admin not", () => {
    const policy = policyOf("mahaurja.maharashtra.gov.in");
    expect(mayFetch(policy, "/Site/1607/Tenders-EoI-Offers")).toBe(true);
    expect(mayFetch(policy, "/search?q=tender")).toBe(false);
    expect(mayFetch(policy, "/admin")).toBe(false);
  });

  it("CIDCO: a query-string rule with a wildcard binds", () => {
    const policy = policyOf("cidco.maharashtra.gov.in");
    expect(mayFetch(policy, "/Page?Token=DE0E063C112")).toBe(true);
    expect(mayFetch(policy, "/Page?q=tender")).toBe(false);
    expect(mayFetch(policy, "/login")).toBe(false);
  });

  it("DGIPR and Maha Metro: the notices and tender pages are permitted", () => {
    expect(mayFetch(policyOf("dgipr.maharashtra.gov.in"), "/notices")).toBe(true);
    expect(mayFetch(policyOf("www.mahametro.org"), "/tenders")).toBe(true);
    expect(mayFetch(policyOf("www.mahametro.org"), "/cgi-bin/x")).toBe(false);
  });
});

describe("a policy we cannot read is a refusal", () => {
  it("a single-page app served in place of robots.txt is not a policy", () => {
    const body = fixture("mahammb.maharashtra.gov.in");
    expect(readRobots(body, 200).kind).toBe("unreadable");
    expect(mayFetch(readRobots(body, 200), "/")).toBe(false);
    // Even when the server labels it as text.
    expect(readRobots(body, 200, "text/plain").kind).toBe("unreadable");
  });

  it("404 and 410 state no policy; every other failure refuses", () => {
    expect(mayFetch(readRobots("", 404), "/anything")).toBe(true);
    expect(mayFetch(readRobots("", 410), "/anything")).toBe(true);
    for (const status of [401, 403, 429, 500, 503]) {
      expect(mayFetch(readRobots("", status), "/")).toBe(false);
    }
  });
});

describe("rule precedence", () => {
  const read = (text: string): RobotsPolicy => readRobots(text, 200, "text/plain");

  it("the longest matching rule wins", () => {
    const policy = read("User-agent: *\nDisallow: /a\nAllow: /a/b");
    expect(mayFetch(policy, "/a/c")).toBe(false);
    expect(mayFetch(policy, "/a/b/c")).toBe(true);
  });

  it("a tie goes to Disallow, where the RFC would allow", () => {
    expect(mayFetch(read("User-agent: *\nAllow: /x\nDisallow: /x"), "/x")).toBe(false);
  });

  it("a site-wide disallow is not undone by a narrower allow", () => {
    expect(mayFetch(read("User-agent: *\nDisallow: /\nAllow: /public"), "/public/page")).toBe(
      false,
    );
  });

  it("a group addressed to us binds, merged with the wildcard group", () => {
    const policy = read(
      "User-agent: Googlebot\nDisallow:\n\nUser-agent: LokDarpan\nDisallow: /private\n\nUser-agent: *\nDisallow: /tmp",
    );
    expect(mayFetch(policy, "/private/x")).toBe(false);
    expect(mayFetch(policy, "/tmp/x")).toBe(false);
    expect(mayFetch(policy, "/open")).toBe(true);
  });

  it("a group addressed to someone else does not bind", () => {
    expect(mayFetch(read("User-agent: BadBot\nDisallow: /"), "/x")).toBe(true);
  });

  it("consecutive user-agent lines share one group", () => {
    expect(mayFetch(read("User-agent: Other\nUser-agent: *\nDisallow: /x"), "/x")).toBe(false);
  });

  it("an empty Disallow permits everything", () => {
    expect(mayFetch(read("User-agent: *\nDisallow:"), "/anything")).toBe(true);
  });
});

describe("pattern matching", () => {
  it("honours * and a trailing $", () => {
    expect(patternMatches("/*.pdf$", "/files/a.pdf")).toBe(true);
    expect(patternMatches("/*.pdf$", "/files/a.pdf?x=1")).toBe(false);
    expect(patternMatches("/*?q=", "/page?q=1")).toBe(true);
    expect(patternMatches("/a.b", "/axb")).toBe(false);
  });

  it("takes the path and query of a URL, and insists on a leading slash", () => {
    expect(pathOf("https://www.mhada.gov.in/mr/tenders?page=2")).toBe("/mr/tenders?page=2");
    expect(() => mayFetch({ kind: "none" }, "mr/tenders")).toThrow();
  });
});

describe("the GePNIC connector's question is answered as before", () => {
  it("refuses a site-wide disallow and nothing narrower", () => {
    expect(permitsCrawling("User-agent: *\nDisallow: /", 200)).toBe(false);
    expect(permitsCrawling("User-agent: *\nDisallow: /private", 200)).toBe(true);
    expect(permitsCrawling("", 404)).toBe(true);
    expect(permitsCrawling("", 500)).toBe(false);
  });

  it("an HTML 404 page, as every collected portal served on 2026-09-30, is permission", () => {
    // An HTML body is now unreadable — a refusal — but only with status 200.
    // Every portal the nightly job collects answered 404, which states no policy.
    expect(permitsCrawling('<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">', 404)).toBe(true);
  });
});
