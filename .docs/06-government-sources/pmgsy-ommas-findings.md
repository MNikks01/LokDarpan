# PMGSY / OMMAS — located, reachable, and licence-blocked

**Date:** 28 August 2026 · **Supersedes:** row 27 of [`data-availability-matrix.md`](./data-availability-matrix.md), and qualifies rows 16–19

Sprint 0 recorded OMMAS as _"not reachable from the verification vantage point; existence not disproven"_ and named it the highest-value unverified candidate — the one source that might supply the execution half of the project graph. It was retried on 28 August. It is not unreachable. It moved, and it publishes exactly what was missing, under terms that forbid us using it.

---

## Why it looked unreachable: the host no longer exists

| Name                  | Local resolver    | Google 8.8.8.8    | Verdict                           |
| --------------------- | ----------------- | ----------------- | --------------------------------- |
| `online.omms.nic.in`  | no A record       | no A record       | Does not resolve                  |
| `omms.nic.in`         | no A record       | no A record       | Does not resolve                  |
| `nrida.nic.in`        | no A record       | no A record       | Does not resolve                  |
| `pmgsy.nic.in`        | `164.100.166.202` | `164.100.166.202` | Resolves; ports 80 and 443 refuse |
| `pmgsytenders.gov.in` | resolves          | —                 | **HTTP 200**                      |

`omms.nic.in` returns **no NS records** while its parent `nic.in` returns them normally. The subdomain zone is not published in public DNS.

**This corrects the earlier reading.** Sprint 0 treated the failure as a vantage-point restriction, by analogy with `lgdirectory.gov.in`, which failed on one channel and succeeded on another. That analogy does not hold here: a name absent from two independent resolvers, whose zone has no delegation, is not being withheld from us — it is gone. The standing rule still applies in the other direction, though, and is why this was worth retrying rather than recording as absent.

`pmgsy.nic.in` is the genuine vantage-point case: it resolves, and refuses connections on both ports from both channels.

## Where it went

The system now runs at **`pmgsygov.dord.gov.in`** (login-gated, officer-facing — not approached) with a public citizen portal at **`pmgsy.dord.gov.in`**.

- `https://pmgsy.dord.gov.in/` · HTTP 200 · 159,911 bytes · title _"Online Management, Monitoring & Accounting System (OMMAS) — Pradhan Mantri Gram Sadak Yojana (PMGSY)"_
- No login and no CAPTCHA on the citizen portal.
- `robots.txt` returns HTTP 200 but serves an HTML error document rather than robots directives — no restriction is stated, and none is implied by a soft 404.
- **92 distinct public report routes**, reached by `LoadPage('/Area/Controller/Action')` rather than plain links.

## What it publishes — the execution half, in full

The report menu names, at work level:

- **Agreement Details** and **Contractor's Information** — the contractor link every procurement portal gates behind a CAPTCHA
- **Sanction Work Progress**, **PMGSY-I Road Work Status**, **PMGSY-I Bridge Work Status**, **Pending Works**, **Dropped Works List**
- **Final Bill Payment** and **Final Bill Payment Abstract** — per-work expenditure
- **Completed Roads with Value of Work Done**, **Per Kilometer Cost**
- **Layer Wise Length – Inprogress Road**, **DLP Road Inspection**, quality grading per work
- **Road-Wise Core Network**, **District Brief**, geo-tagged habitation monitoring

Headline figures on the public page: _1,97,951 works cleared · 8,57,061 km sanctioned · 7,97,662 km completed_.

That is the register [`data-availability-matrix.md`](./data-availability-matrix.md) rows 16–19 record as having no source located — work orders, physical and financial progress, completion, per-project expenditure — plus row 12's contractor identity.

## Why we still cannot use it

`https://pmgsy.dord.gov.in/Home/HomeLegalNotice/` · HTTP 200 · title _"Legal Notices"_ · content owner **National Rural Infrastructure Development Agency (NRIDA)**. Quoted verbatim from the served HTML:

> "the Materials may not be copied, reproduced, modified, published, republished, uploaded, downloaded, posted, transmitted, or distributed in any way, without NRIDA's prior written permission"

> "You may download one copy of the Materials on a single computer for your personal, non-commercial internal use only unless specifically licensed to do otherwise by NRIDA in writing"

**These are the most restrictive terms of any source examined.** BEAMS requires permission before _publishing_; NRIDA requires it before copying or downloading at all, and confines even that to personal, non-commercial, single-machine use. Systematic collection is outside those terms before any question of display arises.

Characterisation stopped at the menu for this reason. No report was harvested, and no work-level data was collected.

## What this changes

**Rows 16–19 were right that no _usable_ source was located, and wrong in what they implied.** The data exists, is published, and needs no credential — for PMGSY rural roads. The blocker was never discovery. It is a licence.

**It would not have covered the original scope anyway.** PMGSY is rural roads under the Ministry of Rural Development. Maharashtra PWD state highways, MDR and ODR — the Nagpur scope in the brief — are not in it. It would have narrowed Phase 1 to rural roads, which [`phase-1-maharashtra-roads.md`](./phase-1-maharashtra-roads.md) §44 already anticipated.

**Three of four sources now turn on permission.** LGD and CAG permit republication; BEAMS and PMGSY do not. Every remaining route to the execution half runs through a written request to a government body, which is the decision the project has so far avoided.

## What has not been established

- Whether any individual report returns data without a login. The menu is public; each report was left unfetched, because the terms forbid the collection that testing would constitute.
- Whether NRIDA would grant permission if asked. Not asked.
- Whether `pmgsy.nic.in` serves anything. It refuses connections from both channels; existence not disproven.
- Whether a bulk dataset exists at `/Home/PMGSYRuralDataset` (HTTP 200, 65,138 bytes). Not characterised, for the same reason.
