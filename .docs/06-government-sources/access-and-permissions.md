# Access & Permissions — What We Are Allowed to Collect

**Status:** Sprint 0 finding · 25 August 2026

`docs/15` and [`CONTRIBUTING.md`](../../CONTRIBUTING.md) make honouring `robots.txt` non-negotiable. Before Sprint 2 writes a single connector, this establishes what each source actually permits. It changes the Sprint 2 plan.

---

## The headline finding

**`mahatenders.gov.in` — the Phase-1 primary procurement source — disallows all crawling.**

```text
GET https://mahatenders.gov.in/robots.txt      200 OK
Last-Modified: Tue, 09 Feb 2016 08:35:48 GMT
Content-Length: 27

User-agent: *
Disallow: /
```

Verified as a real, served file — not an error page, not a misread. Automated collection from this host is therefore **not permitted**, and collection stopped as soon as this was found.

`docs/03-Data-Collection-Architecture` names `mh_pwd_works` and Mahatenders as Phase-1 sources. That assumption does not survive contact with the portal's own stated policy.

---

## Survey — all 36 State/UT procurement portals

| Verdict                                        | Count | Portals                                                                          |
| ---------------------------------------------- | ----: | -------------------------------------------------------------------------------- |
| **`Disallow: /` — crawling not permitted**     | **2** | **Maharashtra** (`mahatenders.gov.in`), **Karnataka** (`eproc.karnataka.gov.in`) |
| No `robots.txt` served — no stated restriction |    34 | All other States/UTs                                                             |

Two of thirty-six, and one of them is the state Phase 1 targets. The other thirty-four state no restriction, so the GePNIC connector work remains valid — just not against Maharashtra.

> **Read this narrowly.** No stated restriction means collection is _permitted_; it does not mean the data is _reachable_. Tested 25 Aug: award-of-contract data is CAPTCHA-gated across every GePNIC deployment reached, in permitting states too. See [`gepnic-access-findings.md`](./gepnic-access-findings.md).

### Also disallowed

| Host                     | Policy          | Note                                       |
| ------------------------ | --------------- | ------------------------------------------ |
| `data.gov.in`            | `Disallow: /`   | **But offers an official API** — see below |
| `eprocure.gov.in` (CPPP) | no `robots.txt` | No stated restriction                      |

---

## `robots.txt` governs crawling, not sanctioned APIs

An important distinction, applied carefully rather than as a convenience:

- **`robots.txt` governs automated crawling of web pages.** Where a host says `Disallow: /`, we do not fetch its pages. Full stop.
- **A documented, key-issued API is a different channel.** The publisher is explicitly inviting programmatic access and controlling it through registration and rate limits. Using it is not crawling, and `robots.txt` is not the instrument that governs it.

So `data.gov.in` being `Disallow: /` means **we do not scrape its HTML**; it does not mean we may not use `api.data.gov.in` with an issued key. That is the route the publisher built for this purpose.

**This reasoning must not be stretched.** It applies where a public API is documented and a key is issued. It does not license fetching JSON endpoints discovered by inspecting a disallowed site's network traffic — that is crawling with extra steps, and it is out of bounds.

---

## Consequences for Maharashtra

Phase 1 is Maharashtra roads. Its procurement source is closed to crawling. Four legitimate routes remain, in rough order of preference:

| Route                                                        | Status                     | Notes                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1. Official API or bulk export from Mahatenders**          | **Unknown**                | Cannot be determined without crawling the site. Must be established from documentation or by asking the department                                                                                                       |
| **2. `data.gov.in` API**                                     | **Unknown**                | Whether Maharashtra procurement datasets are published there is not yet established. Requires an API key and a catalogue query                                                                                           |
| ~~**3. CPPP** (`eprocure.gov.in`)~~                          | **Closed — tested 25 Aug** | No `robots.txt`, so permitted. But Bid Awards and Tender Search are **CAPTCHA-gated**, and no bulk export exists. Not viable for automated award collection — [`gepnic-access-findings.md`](./gepnic-access-findings.md) |
| **4. Written permission from the Government of Maharashtra** | Not attempted              | Slow but entirely legitimate, and the right approach for a public-interest platform. Also opens the door to a better feed than scraping would give                                                                       |

**What we do not do:** ignore the policy, use a different user agent, or route around it. The platform's credibility is its only asset, and it would not survive being caught scraping a portal that asked us not to.

---

## Consequences for the sprint plan

| Was                                                                | Now                                                                                                                                          |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 2 builds the GePNIC connector against **Maharashtra** first | Sprint 2 builds it against a **permitting** state — Tamil Nadu, Jharkhand, Odisha or Uttarakhand are all unrestricted GePNIC deployments     |
| Phase 1 procurement data assumed available                         | Maharashtra procurement pursued through routes 1–4 **in parallel**, starting Sprint 0                                                        |
| —                                                                  | **New decision gate:** if no route to Maharashtra procurement data exists by Sprint 3, Phase 1's scope or its target state must be revisited |

The connector work is unaffected in substance: proving the pattern on one permitting state proves it for ~28. Only the choice of first state changes.

### The harder question

If Maharashtra procurement remains unavailable, Phase 1 has three options, and they should be decided deliberately rather than drifted into:

1. **Keep Maharashtra, drop procurement from Phase 1** — ship budget, allocation, hierarchy and audit for Maharashtra; add tenders when a route opens.
2. **Change the Phase-1 state** to one where every source permits collection. Cheap now, expensive after Sprint 3.
3. **Secure permission** and keep the scope. Best outcome, uncertain timeline.

**Resolved 2026-08-25 — option 1.** The sweep in [`gepnic-access-findings.md`](./gepnic-access-findings.md) removed the basis for option 2: award data is CAPTCHA-gated on **every** GePNIC deployment tested, so changing state does not obtain it. Maharashtra's `Disallow: /` is an additional restriction on a platform-wide requirement, not the cause of the gap. Option 3 is not being pursued at this time.

All three remain better than quietly scraping a portal that said no.

---

## Standing rule for every new source

Before a connector is written, record — in the source registry, not in someone's memory:

- [ ] `robots.txt` fetched, verbatim, with its `Last-Modified`
- [ ] Terms of use located and read
- [ ] Rate limits stated or inferred, and honoured
- [ ] Licence captured (required for display; still collected for no source)
- [ ] Whether an official API or bulk export exists — always preferred over scraping
- [ ] CAPTCHA presence noted; **never bypassed**

A source that disallows collection is recorded as such and left alone. That is a finding, not a failure.
