# Draft — request for programmatic access to Mahatenders data

**Status:** Draft for the maintainer to review, complete and send · 29 August 2026
**Acts on:** [`tender-ingestion-plan.md`](./tender-ingestion-plan.md) §2b — Route 4, previously unattempted

---

## Before sending — three things to settle

**1. Confirm the addressee.** Not invented here, because guessing it would be the same defect the source registry exists to prevent. `mahatenders.gov.in` is a GePNIC deployment operated for the Government of Maharashtra; the portal's own "Contact Us" page names the responsible office, and the Directorate of Information Technology, Government of Maharashtra is the likely owner. Verify before sending — reading one contact page in a browser is not crawling.

**2. Consider filing an RTI in parallel.** The Right to Information Act 2005 is a formal, legally-backed route with statutory response timelines (ordinarily 30 days), and it costs ₹10. A courteous letter may get a better answer; an RTI gets _an_ answer. They are not mutually exclusive, and the RTI can be narrower: "does a machine-readable export of tender and award data exist, and under what terms may it be obtained?"

**3. Do not overstate the project.** LokDarpan is pre-launch with a thin implementation. Claiming a userbase or an institutional backing it does not have would be both untrue and unnecessary — the request stands on what it is.

---

## Draft letter

> To,
> [**Verify the correct officer and office** — see note 1]
> [Office address]
>
> **Subject:** Request for programmatic access to tender and award-of-contract data published on `mahatenders.gov.in`
>
> Respected Sir/Madam,
>
> I am writing to request guidance on obtaining, through an official channel, the tender and award-of-contract information published on the Maharashtra Government e-Tendering portal, `mahatenders.gov.in`.
>
> **About the project.** I am building LokDarpan, a non-commercial public-interest platform that presents public-finance and infrastructure information drawn entirely from official government records. It links budget, allocation, release and expenditure into a single traceable record, with every figure shown alongside a citation to the government document it was read from. The project is pre-launch and is not funded by any commercial interest. It presents facts and arithmetic from official sources; it does not allege wrongdoing, does not rank or score any firm or officer, and publishes no figure that has not been checked by a person against the source page.
>
> **Why I am writing rather than collecting the data.** The portal's `robots.txt` file states `Disallow: /`, and I have treated that as binding. No automated collection has been carried out against `mahatenders.gov.in`, and none will be unless it is expressly permitted. Award-of-contract information on the platform is additionally protected by an interactive verification step, which I have understood as an indication that access is intended to be interactive rather than automated, and have not attempted to work around.
>
> I would rather ask than assume.
>
> **What I am requesting.** Any one of the following would be of assistance, in order of usefulness:
>
> 1. Whether an official application programming interface, bulk export, or periodic data publication exists for tender and award information, and the terms on which it may be used.
> 2. If no such channel exists, whether permission may be granted for limited, rate-controlled automated collection of publicly displayed tender and award pages — at a frequency and during hours of the Department's choosing.
> 3. If neither is possible, confirmation of that position, so that the project's public documentation may record accurately that this data is not available through an official channel, rather than leaving the question open.
>
> A negative answer is genuinely useful. The project records what each source permits, and an authoritative "no" is better than an assumption.
>
> **On attribution and licensing.** Any data obtained would be attributed to the Department as its publisher and displayed with a link to the source page. I would be glad to comply with any attribution, licensing, caching or refresh conditions the Department wishes to impose, and to submit the intended presentation for review before publication.
>
> I would be happy to provide any further information, or to meet at the Department's convenience.
>
> Thanking you,
> Yours faithfully,
>
> [Full name]
> [Postal address]
> [Email] · [Telephone]
> [Project repository URL, if you wish to share it]
> Date: [ ]

---

## If a reply arrives

Record it in the source registry regardless of the answer, following the standing rule in [`access-and-permissions.md`](./access-and-permissions.md):

- **Permission granted** — capture the terms verbatim, the granting authority and the date; add the licence to the registry entry; only then write the connector.
- **Official API disclosed** — this settles Route 1, and the source registry entry moves from `DISCOVERED` toward `VERIFIED`.
- **Refused, or no reply within the RTI timeline** — record it as _"access requested [date]; refused / no response as of [date]"_. Never as _"the Government of Maharashtra does not publish this."_ The distinction between what was refused and what does not exist is the registry's founding rule.
