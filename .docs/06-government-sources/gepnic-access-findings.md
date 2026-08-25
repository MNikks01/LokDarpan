# GePNIC access findings — award data is CAPTCHA-gated platform-wide

**Date:** 2026-08-25 · **Method:** [`access-and-permissions.md`](./access-and-permissions.md) §Standing rule — `robots.txt` first, then page fetches, evidence recorded per host.

## Summary

The [`robots.txt` survey](./access-and-permissions.md) established that 34 of 36 State/UT procurement portals state no crawl restriction. That is true, and it was read too optimistically: **`robots.txt` permitting collection does not mean the data is collectable.**

Award-of-contract data — which firm won a tender, at what value — sits behind a mandatory CAPTCHA on **every GePNIC deployment reached**, and on the Central Public Procurement Portal. This is a property of the GePNIC platform, not of any one state.

**Consequence:** changing the Phase-1 state does not obtain procurement award data. Maharashtra's `Disallow: /` is an additional restriction layered on a platform-wide interactive-verification requirement that applies everywhere.

---

## What was tested

Two-phase sweep across 16 states — 32 hosts, procurement portal and treasury/expenditure system for each.

### Phase 1 — reachability and `robots.txt`

Eight states have **both** their procurement portal and their treasury system reachable with no stated crawl restriction:

Tamil Nadu · Odisha · Kerala · Rajasthan · Andhra Pradesh · Telangana · West Bengal · Punjab

Maharashtra is **treasury-only**: `beams.mahakosh.gov.in` unrestricted, `mahatenders.gov.in` `Disallow: /`.

Hosts returning no response are recorded as _not reachable from the verification vantage point on 2026-08-25; existence not disproven_ — not as unavailable.

### Phase 2 — is the data actually reachable?

Tested against `tntenders.gov.in`, and the CAPTCHA result reproduced on Odisha, Kerala, Rajasthan, West Bengal and Punjab (17 CAPTCHA references on each).

| GePNIC page                                | CAPTCHA                         | Data rows               |
| ------------------------------------------ | ------------------------------- | ----------------------- |
| `/nicgep/app` (landing)                    | no                              | **~21 current tenders** |
| `WebTenderStatusLists` (Award of Contract) | **`Enter Captcha *` mandatory** | none                    |
| `FrontEndLatestActiveTenders`              | **yes**                         | none                    |
| `FrontEndTendersByOrganisation`            | **yes**                         | none                    |
| `FrontEndTendersByLocation`                | **yes**                         | none                    |

**A misreading worth recording.** These pages return 116–125 `<tr>` rows, which reads as a populated result set. They are not: the rows are the search form's own dropdown scaffolding, and every one contains `-Select-`. Row count is not evidence of data. Cell contents were inspected before any conclusion was drawn.

### Central Public Procurement Portal

| Property                          | Finding                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `robots.txt`                      | **None served** (404) — no stated restriction                                                     |
| `resultoftendersnew` (Bid Awards) | CAPTCHA-gated (`captcha_sid`, `captcha_token` form fields)                                        |
| `tendersearch`                    | CAPTCHA-gated; has an `s_state` filter                                                            |
| `latestactivetendersnew`          | 11 rows render — a rolling active-tender window                                                   |
| Bulk download                     | None. `/downloaddisp` offers only STQC certificates and a PDF list of participating organisations |

This **corrects** the entry in [`access-and-permissions.md`](./access-and-permissions.md) §Consequences for Maharashtra, which recorded CPPP as _"Permitted, coverage unknown"_. It is permitted and not viable for automated award collection.

---

## What remains collectable

**The GePNIC landing page.** ~21 current tenders per portal, no CAPTCHA, no stated crawl restriction. Polling once daily accumulates the tender universe **forward from the date collection starts**. It does not backfill history and never yields awards, but it costs one request per portal per day and can begin immediately.

**`data.gov.in`'s API — unresolved.** The catalogue endpoint answered with **no API key**: `status: ok`, 285,974 resources. The `q` parameter had no effect on results, so whether Maharashtra procurement datasets are published there is **not yet established** — neither confirmed nor excluded. This is the remaining route to award data that requires no correspondence with any department, and it is worth completing.

---

## What was not done

**No CAPTCHA was solved, submitted to, or circumvented.** Where a CAPTCHA was found, testing stopped at that page. No alternative user agent, proxy or JSON endpoint discovered through a gated page's network traffic was used — [`access-and-permissions.md`](./access-and-permissions.md) rules that out explicitly, and it remains ruled out.

A CAPTCHA is a publisher stating that access should be interactive. That is a finding to record, not an obstacle to route around.

---

## Consequence for Phase 1

**Maharashtra is retained.** The case for changing state rested on obtaining procurement data elsewhere; that case does not survive this sweep. Changing state would require re-verifying a new treasury system and would abandon BEAMS — verified, ten years, monthly, to DDO level, no login ([`sprint0-findings-q1-q3.md`](./sprint0-findings-q1-q3.md)) — in exchange for award data that is unavailable in the new state too.

The eight both-open states remain the right proving ground for the GePNIC connector, which is unaffected in substance: the collectable surface is identical in all 34 permitting states.
