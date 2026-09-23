# Source licences — what we are allowed to republish

**Status:** Verified 28 August 2026; GePNIC tender portals and OpenStreetMap added 17 September 2026 · Closes row 32 of [`data-availability-matrix.md`](./data-availability-matrix.md)

[`access-and-permissions.md`](./access-and-permissions.md) answers a different question — _may we collect this?_ — from `robots.txt`. This answers _may we publish it?_, from each publisher's own stated terms. A source can be freely crawlable and still not freely republishable, and only the second question governs what a reader is allowed to see.

Every entry below was **fetched**, not recalled. No licence is recorded from memory, and no permission is inferred from silence.

---

## The finding, stated first

**Two of our three sources permit republication outright. The third — BEAMS — requires written permission first.**

**Resolved 5 September 2026, without asking.** Permission has not been sought and is not
being sought for now, so **BEAMS figures are not rendered**. The department page is
withheld behind `PUBLISH_BEAMS_FIGURES`, off unless explicitly set, and the withholding
happens before the fetch so no treasury figure enters a response that might be cached.

This withholds **display, not collection**. BEAMS is still ingested, and its figures are
still what a CAG figure is checked against — a comparison a reader never sees still catches
an error. The day permission is sought and granted, one environment variable publishes the
page with no code change.

The line above about BEAMS supplying "every monetary figure the site currently renders" is
also now out of date: all 5,164 published facts come from CAG, which permits reproduction
outright.

| Source                           | Host                          | Republication                                                             | Attribution                              |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| Local Government Directory       | `lgdirectory.gov.in`          | **Permitted**, no permission needed                                       | Required, prominent                      |
| CAG audit reports                | `cag.gov.in`                  | **Permitted**, no permission needed                                       | Required, prominent                      |
| BEAMS                            | `beams.mahakosh.gov.in`       | **Permission required in writing**                                        | Required                                 |
| GePNIC state tender portals (21) | e.g. `etenders.kerala.gov.in` | **Permission required** (written, for Madhya Pradesh); linking needs none | Required where stated                    |
| OpenStreetMap                    | `openstreetmap.org`           | **Permitted** under ODbL 1.0                                              | Required: "© OpenStreetMap contributors" |

---

## 1. Local Government Directory — permitted

**Fetched:** `https://lgdirectory.gov.in/copyRightPolicy.do` · 28 Aug 2026 · HTTP 200 · title _"LGD - Copyright Policy"_
Link discovered from the footer of `https://lgdirectory.gov.in/`, not written from memory.

> "Material featured on this site may be reproduced free of charge in any format or media without requiring specific permission. This is subject to the material being reproduced accurately and not being used in a derogatory manner or in a misleading context. Where the material is being published or issued to others, the source must be prominently acknowledged. However, the permission to reproduce this material doesn't extend to any material on this site, which is explicitly identified as being the copyright of a third party."

Content ownership, from the same site's footer:

> "Contents on this website is owned, updated and managed by the Panchayats and State Panchayati Raj Department as a part of e-Panchayat MMP of Ministry of Panchayati Raj."

**Consequence:** administrative-hierarchy data may be published. Attribution must name the Ministry of Panchayati Raj, and must be prominent — a hidden or hover-only credit does not satisfy "prominently acknowledged".

---

## 2. CAG audit reports — permitted

**Fetched:** `https://cag.gov.in/ag/bihar/en/page-ag-bihar-copyright-policy` · 28 Aug 2026 · HTTP 200 · title _"Copyright Policy"_ · content owner stated as _"Comptroller and Auditor General of India"_

> "Material featured on this website may be reproduced free of charge. This is subject to the material being reproduced accurately and not to be used in a derogatory manner or in a misleading context. Wherever the material is being published or issued to others, the source must be prominently acknowledged. The permission to reproduce this material shall not extend to any material which is identified as being copyright of a third party."

**A limit on this evidence, stated plainly.** This is the copyright policy of one CAG office site. Our PDFs are served from `cag.gov.in/webroot/uploads/…` on the main site. The policy text is identical across every CAG office page sampled and the stated content owner is the CAG itself rather than the office, so it is _reasonable_ to read it as the institution's policy — but the main site's own copyright page was not located at a distinct URL, and that has not been proven. Recorded as **verified for the office sites, inferred for the main site.**

**Consequence:** audit-report extracts may be published with prominent attribution to the Comptroller and Auditor General of India. The "not misleading" condition is not decorative — it is the same obligation the project's own neutrality rules already impose, and publishing a figure without its scope note would breach both at once.

---

## 3. BEAMS / Maharashtra Finance Department — permission required

**Fetched:** `https://finance.maharashtra.gov.in/en/website-policies/` · 28 Aug 2026 · HTTP 200

> "Material featured on this website may be reproduced free of charge **after taking proper permission by sending a mail to us**."

That is the opposite of the other two. LGD and CAG say _without requiring specific permission_; the Finance Department says _after taking proper permission_. The difference is the entire question.

Also observed on 28 Aug 2026:

- `https://beams.mahakosh.gov.in/robots.txt` → **HTTP 404**. No crawl restriction stated. Collection was never the problem.
- `https://mahakosh.maharashtra.gov.in/index.php` → **TLS error, "unable to verify the first certificate"**. The portal's own certificate chain did not validate from this vantage point. Recorded as observed; existence not disproven.
- `https://finance.maharashtra.gov.in/en/mahakosh/` footer: _"Content Owned by Finance Department"_.

**Two limits on this evidence, both material:**

1. **The policy page is on `finance.maharashtra.gov.in`; BEAMS is served from `beams.mahakosh.gov.in`.** No copyright policy was located on the BEAMS host itself. Reading the Finance Department's policy as governing a Finance Department system is an inference — a reasonable one, since `finance.maharashtra.gov.in/en/mahakosh/` is the department's own page for the Directorate that operates BEAMS — but it is an inference, and it is recorded as one.
2. **Whether a copyright policy reaches the underlying figures at all is a legal question this project cannot answer.** A copyright policy governs material — pages, compilations, documents. Budget figures are facts about public money. This document does not resolve that, does not assert it either way, and is not legal advice. `.docs/17-legal/legal-ethical-rules.md` is explicit that LokDarpan is not a legal authority.

---

## 4. PMGSY / OMMAS — republication forbidden, and collection with it

**Fetched:** `https://pmgsy.dord.gov.in/Home/HomeLegalNotice/` · 28 Aug 2026 · HTTP 200 · title _"Legal Notices"_ · content owner **National Rural Infrastructure Development Agency (NRIDA)**

> "the Materials may not be copied, reproduced, modified, published, republished, uploaded, downloaded, posted, transmitted, or distributed in any way, without NRIDA's prior written permission"

> "You may download one copy of the Materials on a single computer for your personal, non-commercial internal use only unless specifically licensed to do otherwise by NRIDA in writing"

The most restrictive terms examined, and the only ones that reach _collection_ rather than only display. BEAMS requires permission before publishing; NRIDA requires it before copying at all.

This matters more than the others because of what sits behind it: the work-level agreement, contractor, progress, completion and final-bill data that rows 16–19 of the availability matrix record as having no source located. It exists, it needs no credential, and it may not be taken. See [`pmgsy-ommas-findings.md`](./pmgsy-ommas-findings.md).

---

## 5. GePNIC state tender portals — permission required

**Found 17 September 2026, while building source descriptors for the explorer — and not recorded before, although tenders from these portals have been listed on the explorer since #55 (`93bc1ef`).**

Each portal's footer links "Portal policies" at `/nicgep/app?page=Disclaimer&service=page`. The
page was fetched from all 21 portals in `services/ingestion/src/gepnic/portals.ts` on
17 Sep 2026, each after opening a session on the landing page, and each answered **HTTP 200**.
Twenty publish the same Copyright Policy. Fetched from `https://etenders.kerala.gov.in/nicgep/app?page=Disclaimer&service=page`
(title _"eTendering System Government of Kerala"_), and identical on the other nineteen:

> "The contents published in this portal are primarily owned by the respective Government / Organisation /Department."

> "Material featured on this Portal maybe reproduced free of charge **after taking proper permission** from the respective Organisation / Department."

> "However, the material has to be reproduced accurately and not to be used in a derogatory manner or in a misleading context and as per the guidelines provided by the respective Government / Department."

> "We do not object to you linking directly to the information that is hosted on this eProcurement Portal and no prior permission is required for the same."

**Madhya Pradesh (`mptenders.gov.in`) is stricter** in two respects:

> "Material featured on this Portal maybe reproduced free of charge after taking proper **written** permission from the respective Organisation / Department."

> "Wherever the material is being published or issued to others, the source must be prominently acknowledged."

Portals checked: Arunachal Pradesh, Assam, Goa, Haryana, Himachal Pradesh, Jharkhand, Kerala,
Madhya Pradesh, Manipur, Meghalaya, Mizoram, Nagaland, Odisha, Punjab, Rajasthan, Sikkim, Tamil
Nadu, Tripura, Uttar Pradesh, Uttarakhand, West Bengal.

**This is the BEAMS clause, on every portal we collect.** Permission has not been sought from any
department. The explorer nonetheless shows tender titles, references, departments, organisation
chains, values and locations from these portals. The rule at the end of this document says such a
source is not publishable. `mayRepublish` would refuse it, but only the CAG document path calls
`mayRepublish`, and the tender path does not. **Resolved 17 September 2026, the same way as BEAMS: tender details are withheld, and the reader is
linked to the state's portal instead** ([`../adr/056-a-tender-is-linked-to-not-reproduced.md`](../adr/056-a-tender-is-linked-to-not-reproduced.md)).
Counts and district shading remain, as LokDarpan's own measurement. `PUBLISH_TENDER_DETAILS` restores
the lists once permission exists.

Two limits, as with BEAMS:

1. **"Respective Organisation / Department" is not one body.** A tender is issued by a specific
   department, so permission is per department, not per portal. That is materially harder than
   BEAMS's single address.
2. **Whether a copyright policy reaches a tender's facts** (its title, reference, value and closing
   date as published notices of intent to buy) is the same unresolved legal question as for BEAMS.
   Not answered here.

---

## 6. OpenStreetMap — permitted under ODbL

**Fetched:** `https://www.openstreetmap.org/copyright` · 17 Sep 2026 · HTTP 200

The page states that OpenStreetMap data is licensed under the **Open Data Commons Open Database
License**, and asks users to credit OpenStreetMap by displaying its attribution notice, as a credit
in the corner of the map. The explorer already shows "© OpenStreetMap contributors" for both the
base map and the boundaries.

The page also states: "If you alter or build upon our data, you may distribute the result only
under the same license." Our simplified boundaries are data built upon theirs. That obligation is
recorded here rather than resolved.

---

## What this blocks, concretely

Every monetary figure the site renders today comes from BEAMS: the unit pages and the departmental finance page. Under the Finance Department's stated terms, publishing those to the public requires asking first.

This collides with a decision already taken on the project — **not to approach government while building**. The two cannot both hold for BEAMS-derived display. The options, without preference:

1. **Request permission.** Costs the "don't notify" position; it is the only route the stated policy offers, and a refusal would be far cheaper to discover now than after launch.
2. **Take legal advice on whether the policy reaches the figures.** Resolves the question this document deliberately leaves open. Not free, and not fast.
3. **Launch on LGD and CAG only**, holding BEAMS figures back. Costs the money half of the ledger — which is most of what currently works.
4. **Publish and rely on the facts/expression distinction.** Recorded for completeness. It puts an unresolved legal question in front of a public-interest project whose entire credibility rests on being careful, and this document does not recommend it.

---

## The rule this establishes

**A source with no recorded licence is not publishable.** Not "publishable until someone checks" — the default is withheld, because the cost of the two errors is not symmetric: withholding a figure delays a reader, publishing one we had no right to publish damages the project's standing at exactly the point where its standing is the whole product.

Enforced in `packages/domain/src/source-licence.ts`: a source id with no entry cannot be republished, and adding a source without recording its terms fails the type check.
