/**
 * The GePNIC deployments this connector may collect from.
 *
 * GENERATED FROM THE SOURCE REGISTRY, NOT TYPED FROM MEMORY
 * Every base URL comes from `.docs/06-government-sources/source-registry.json`,
 * where each was discovered from an official directory and then fetched with
 * its HTTP status recorded.
 *
 * WHY THE STATE CODE TRAVELS WITH THE PORTAL
 * District names are matched after a normalisation lossy enough to collapse
 * eighteen pairs of distinct districts nationwide — Pune with Panna, Karnal
 * with Kurnool. Scoping candidates to the portal's own state removes every one
 * of those collisions, so pairing each portal with its state is what makes a
 * placement safe rather than a convenience.
 *
 * WHAT IS DELIBERATELY ABSENT
 * Maharashtra runs GePNIC and serves `Disallow: /`, so a filter on platform
 * alone selects it. It is excluded by name where this file is generated — the
 * first draft of this table listed it under a comment claiming it did not.
 * Karnataka also disallows crawling but never reaches this table, because the
 * registry records it as a state-specific platform rather than GePNIC.
 *
 * The connector re-reads `robots.txt` on every run and would refuse either
 * regardless, but a table naming a host we may not crawl invites someone to
 * try.
 *
 * Non-GePNIC deployments — Gujarat's nProcure, Andhra Pradesh, Telangana,
 * Bihar, Chhattisgarh — are absent because this parser does not fit them.
 * Their pages are a different shape, and pretending otherwise would produce
 * silent nonsense rather than an error.
 */

export interface Portal {
  readonly code: string;
  readonly state: string;
  /** LGD code of the state, for scoping district matching. */
  readonly stateLgdCode: string;
  readonly baseUrl: string;
}

export const PORTALS: readonly Portal[] = [
  {
    code: "arunachalpra",
    state: "Arunachal Pradesh",
    stateLgdCode: "12",
    baseUrl: "https://arunachaltenders.gov.in",
  },
  { code: "assam", state: "Assam", stateLgdCode: "18", baseUrl: "https://assamtenders.gov.in" },
  { code: "goa", state: "Goa", stateLgdCode: "30", baseUrl: "https://eprocure.goa.gov.in" },
  { code: "haryana", state: "Haryana", stateLgdCode: "6", baseUrl: "https://etenders.hry.nic.in" },
  {
    code: "himachalprad",
    state: "Himachal Pradesh",
    stateLgdCode: "2",
    baseUrl: "https://hptenders.gov.in",
  },
  {
    code: "jharkhand",
    state: "Jharkhand",
    stateLgdCode: "20",
    baseUrl: "https://jharkhandtenders.gov.in",
  },
  {
    code: "kerala",
    state: "Kerala",
    stateLgdCode: "32",
    baseUrl: "https://etenders.kerala.gov.in",
  },
  {
    code: "madhyaprades",
    state: "Madhya Pradesh",
    stateLgdCode: "23",
    baseUrl: "https://mptenders.gov.in",
  },
  {
    code: "manipur",
    state: "Manipur",
    stateLgdCode: "14",
    baseUrl: "https://manipurtenders.gov.in",
  },
  {
    code: "meghalaya",
    state: "Meghalaya",
    stateLgdCode: "17",
    baseUrl: "https://meghalayatenders.gov.in",
  },
  {
    code: "mizoram",
    state: "Mizoram",
    stateLgdCode: "15",
    baseUrl: "https://mizoramtenders.gov.in",
  },
  {
    code: "nagaland",
    state: "Nagaland",
    stateLgdCode: "13",
    baseUrl: "https://nagalandtenders.gov.in",
  },
  {
    code: "odisha",
    state: "Odisha",
    stateLgdCode: "21",
    baseUrl: "https://www.tendersodisha.gov.in",
  },
  { code: "punjab", state: "Punjab", stateLgdCode: "3", baseUrl: "https://eproc.punjab.gov.in" },
  {
    code: "rajasthan",
    state: "Rajasthan",
    stateLgdCode: "8",
    baseUrl: "https://eproc.rajasthan.gov.in",
  },
  { code: "sikkim", state: "Sikkim", stateLgdCode: "11", baseUrl: "https://sikkimtender.gov.in" },
  {
    code: "tamilnadu",
    state: "Tamil Nadu",
    stateLgdCode: "33",
    baseUrl: "https://tntenders.gov.in",
  },
  {
    code: "tripura",
    state: "Tripura",
    stateLgdCode: "16",
    baseUrl: "https://tripuratenders.gov.in",
  },
  {
    code: "uttarpradesh",
    state: "Uttar Pradesh",
    stateLgdCode: "9",
    baseUrl: "https://etender.up.nic.in",
  },
  {
    code: "uttarakhand",
    state: "Uttarakhand",
    stateLgdCode: "5",
    baseUrl: "https://uktenders.gov.in",
  },
  {
    code: "westbengal",
    state: "West Bengal",
    stateLgdCode: "19",
    baseUrl: "https://wbtenders.gov.in",
  },
];

export function portalByCode(code: string): Portal | undefined {
  return PORTALS.find((p) => p.code === code);
}
