# Draft — request to Maharashtra PWD for its tender notices and published documents

**Status:** Draft for the maintainer to review, complete and send · 30 September 2026
**Acts on:** backlog `MHA-TENDER-002` in [`../04-data-engineering/maharashtra-tender-ingestion.md`](../04-data-engineering/maharashtra-tender-ingestion.md); evidence in [`maharashtra-tenders/maharashtra-tender-data.md`](./maharashtra-tenders/maharashtra-tender-data.md) §§9–11.

---

## Why this request, and why two parts

1. **The NIT system asks crawlers not to collect it.** PWD's website sends readers for Notices Inviting Tender to `http://mahapwd.gov.in/nit/default.asp`. That host serves `robots.txt: User-agent: * / Disallow: /` (verified 2026-09-30; [`evidence-mahapwd-robots.txt`](./evidence-mahapwd-robots.txt)). LokDarpan honours that, so the system is not collected. It is the most useful Maharashtra tender source found — PWD's own works, browsable by region and district, with no CAPTCHA — which is why it is worth asking for.
2. **PWD's website requires permission to reproduce its content.** Its _Website Policies_ page (`https://pwd.maharashtra.gov.in/वेबसाइट-धोरणे/`, read 2026-09-30) states, in Marathi, that information on the site may be reproduced free of charge **after permission is obtained by sending an email**; that it must be reproduced accurately and not in a derogatory or misleading context; and that the source must be prominently acknowledged. PWD's Roads & Bridges project lists and performance budgets are on that site. Its `robots.txt` permits collecting them as evidence; **showing their contents on LokDarpan needs this permission.**

One letter asks for both.

## Before sending — three things to settle

**1. Confirm the addressee.** PWD's _Web Information Manager_ page (`https://pwd.maharashtra.gov.in/वेब-माहिती-व्यवस्थापक/`, read 2026-09-30) names the office as the **Joint Secretary (Services), Public Works Department, 4th floor, Mantralaya, Mumbai 400032**, with the email `jsser.pwd@maharashtra.gov.in` (written on the page with `[dot]` and `[at]`). The copyright policy asks for permission by email, so that is the channel it names. The legacy NIT host may be run by a different office; ask the Joint Secretary to forward that part if so, rather than guessing a second addressee.

**2. Keep it short and specific.** Two defined permissions, not a partnership: the pages, the rate, the use.

**3. Do not overstate the project.** LokDarpan is pre-launch. Say what it is and what it does not do.

---

## Draft letter

> To,
> The Joint Secretary (Services),
> Public Works Department, Government of Maharashtra,
> 4th floor, Mantralaya, Mumbai 400032
>
> **Subject:** Request for permission (1) to reproduce information published on `pwd.maharashtra.gov.in`, and (2) for limited automated access to the Notice Inviting Tender pages at `mahapwd.gov.in/nit/`
>
> Respected Sir/Madam,
>
> I am writing, as your website's copyright policy asks, to request permission to reproduce certain information published by the Public Works Department, and to ask whether limited automated access to the Department's Notice Inviting Tender pages may be permitted.
>
> **About the project.** LokDarpan is a non-commercial public-interest platform that presents public-finance and infrastructure information drawn only from official government records. Every figure it shows is cited to the government document and page it was read from, with the date it was retrieved. It presents facts and arithmetic from official sources; it does not allege wrongdoing, does not rank or score any firm or officer, and does not publish any figure that a person has not checked against its source. The project is pre-launch and is not funded by any commercial interest.
>
> **1. Reproduction of published documents.** Your website's copyright policy permits reproduction free of charge after permission is obtained by email, provided the information is reproduced accurately, not in a derogatory or misleading context, and with the source prominently acknowledged. I request that permission for:
>
> - the region-wise lists of Roads and Bridges projects published under _Documents → Roads and Bridges_; and
> - the Department's performance budgets and budget books published under _Documents → Budget_.
>
> LokDarpan would reproduce individual entries (for example, the name, location and stated amounts of a work), each with a link to the Department's own document and the date it was read. It would not alter the documents, and would not use them in a derogatory or misleading context.
>
> **2. Automated access to the Notice Inviting Tender pages.** Your website links to `http://mahapwd.gov.in/nit/default.asp` for Notices Inviting Tender. That site's `robots.txt` file asks automated agents not to collect it, and I have treated that as binding: no automated collection has been carried out, and none will be unless it is expressly permitted. I request permission to read the publicly displayed notice pages and their documents automatically:
>
> - at most one request every few seconds, during hours of the Department's choosing;
> - identified by a user agent naming LokDarpan and a contact address;
> - on terms of the Department's choosing, including any attribution you require.
>
> If an official export or data feed of these notices already exists, I would be glad to use that instead.
>
> **3. If permission cannot be given,** a short reply saying so would itself be useful, so that the project's public documentation can record accurately that this information is not available through an official channel, rather than leaving the question open.
>
> I would be glad to provide any further information, or to show how the Department's information would appear before anything is published.
>
> Yours faithfully,
> [Name]
> [Contact email] · [Phone]
> [Project URL]

---

## After sending

Record the date, channel and any reference in [`permission-requests.json`](./permission-requests.json) (entry `maharashtra-pwd`) and set its status to `sent` — the registry's test refuses `sent` without a date and a reference. Until a reply grants permission:

- `mahapwd.gov.in` is not collected at all;
- PWD documents on `pwd.maharashtra.gov.in` may be collected as evidence, but their contents are not displayed on the site.
