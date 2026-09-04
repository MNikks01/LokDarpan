# Sprint 0 Findings — Q1 and Q3

**Date:** 25 August 2026 · **Method:** direct verification, `robots.txt` checked before any page fetch on every host

Companion to [`access-and-permissions.md`](./access-and-permissions.md), which answered the collection-permission question and found Maharashtra's procurement portal closed to crawling.

---

## Summary

|        | Question                                               | Answer                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | Does Maharashtra PWD publish a public works register?  | **No** — not on its public website                                                                                                                                                                                    |
| **Q2** | Is PMGSY's OMMAS publicly accessible?                  | **Answered 28 Aug, after this session** — reachable and licence-blocked ([`pmgsy-ommas-findings.md`](./pmgsy-ommas-findings.md)). As recorded here on 25 Aug: still unknown, host unreachable from this vantage point |
| **Q3** | Does BEAMS expose allocation and expenditure publicly? | **Yes** — and more than expected                                                                                                                                                                                      |

---

## Q1 — Maharashtra PWD works register: **No**

`pwd.maharashtra.gov.in` permits collection (`robots.txt` disallows only `/wp-admin/`). What it publishes:

| Surface                                | What it actually is                                                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `/en/projects/` "Projects/Initiatives" | **A photo gallery.** "8 Images — Opening Ceremony", "54 Images — Landmark Projects", "35 Images — 100 Days Projects" |
| `/project/<slug>` pages                | Individual showcase items — Raj Bhavan Mumbai, a waterfall in Thane, a bridge over the Pranhita, MDR-64              |
| `/en/publication-type/reports/`        | One publication: a Critical Habitat Assessment desktop screening                                                     |
| Tenders                                | An outbound link to `mahatenders.gov.in` — the host that disallows crawling                                          |

It is a WordPress communications site. There is no queryable register of works, no per-work progress, no per-work expenditure.

**This matters because `docs/03-Data-Collection-Architecture` specifies a source `mh_pwd_works` supplying `work_id`, `project_name`, `allocation_amount`, `expenditure_amount` and physical progress.** No such public feed was found.

> **Stated precisely:** a works register was **not identified on Maharashtra PWD's public website as of 25 August 2026**. That is not a claim that none exists. It may be an internal MIS, live on an unlinked subdomain, or obtainable on request or by RTI. Establishing that is a separate task.

---

## Q3 — BEAMS: **Yes, and it is the most useful thing found so far**

`beams.mahakosh.gov.in` serves no `robots.txt`. The main application is login-gated **with a CAPTCHA — which was not touched and must never be**. But a **public MIS reporting section sits outside the login**, and it is substantial.

### Verified public, no authentication

`/Beams5/BudgetMVC/MISRPT/` — fetched, HTTP 200, no login form, no CAPTCHA:

| Report                                              | Granularity                                                    |
| --------------------------------------------------- | -------------------------------------------------------------- |
| `DepartmentExp1.jsp`                                | Department expenditure, **monthly**                            |
| `DepartmentExp1MH.jsp`                              | Department by **major head**                                   |
| `DeptExpAct.jsp`                                    | Department **actual expenditure**                              |
| `DetailHeadWiseExp.jsp`                             | **Detail-head-wise** expenditure                               |
| `dept_objctwiseExp.jsp`                             | **Object-wise** expenditure                                    |
| `MIS_SchemeRule_Report.jsp`                         | **Scheme-wise**                                                |
| `MIS_DDORule_Report.jsp`                            | **DDO-wise** (Drawing & Disbursing Officer — sub-departmental) |
| `DepartmentWiseBudgetYear.jsp`                      | Budget by year                                                 |
| `DepartmentWiseRevenue.jsp`, `DepartmentWiseCA.jsp` | Revenue / capital split                                        |
| `PublicAccount.jsp`, `ExpdReportAll.jsp`            | Public account, consolidated                                   |

**Financial years offered: 2017-18 through 2026-27 — ten years, monthly.**

The index page also links Fund Distribution (`निधी वितरण`) and Budget/Revised Estimates PDFs for several years, though the relative paths on that page 404 as written and need resolving.

### What this gives the ledger

Directly populates the money-out side at **department → major head → detail head → object → scheme → DDO** granularity, with a decade of history and monthly periodicity. Budget Estimates and Revised Estimates map onto `estimateType` BE/RE/actual in the data model.

**What it does not give:** project-level attribution. Expenditure is organised by budget head and DDO, not by work. The tender↔project and expenditure↔project joins remain unsolved.

---

## What this means for the branch decision

The sprint plan branches on whether the project-level chain exists. Q1 and Q3 move the picture:

|                           | Before Sprint 0   | Now                                                                                                                                                                        |
| ------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project-level chain       | Unknown           | **Superseded 28 Aug** — OMMAS publishes it, under terms that forbid republication ([`pmgsy-ommas-findings.md`](./pmgsy-ommas-findings.md)). Maharashtra PWD is not a route |
| Unit/department money-out | Unknown           | **Confirmed available**, 10 years, monthly, to scheme and DDO level                                                                                                        |
| Maharashtra procurement   | Assumed available | **Closed to crawling**; needs a permitted route                                                                                                                            |

**Branch B is stronger than the plan assumed.** It was written as "tender-and-budget intelligence". With BEAMS confirmed, Branch B is _budget → allocation → distribution → actual expenditure, by department, scheme and DDO, across ten years_ — a real financial ledger with genuine analytical depth, just not attributed to individual works.

That is a considerably better product than "tenders and budgets", and it is available today without waiting on anyone.

---

## Recommended next steps

1. **Answer Q2 from an Indian network.** OMMAS is the only remaining route to project-level attribution, and it decides the branch. One `curl` settles it.
2. **Field-verify one BEAMS report end to end** — the reports render via an asynchronous call, so the actual response shape, parameters and stability need establishing before a connector is designed.
3. **Resolve the Fund Distribution PDF paths** on the BEAMS index page.
4. **Pursue Maharashtra procurement through a permitted route** ([`access-and-permissions.md`](./access-and-permissions.md) §Consequences).
5. **Ask whether a PWD works MIS exists** that is simply not linked publicly — a direct question to the department is cheaper than more searching.

---

## Method note

`robots.txt` was fetched for every host **before** any other request. `pwd.maharashtra.gov.in`, `finance.maharashtra.gov.in` and `rdd.maharashtra.gov.in` disallow only `/wp-admin/`; `mahakosh.maharashtra.gov.in` explicitly allows all and publishes a sitemap; `beams.mahakosh.gov.in` and `www.mahakosh.gov.in` serve none. Requests used an identifying user agent, were made at human pace, and no CAPTCHA or login was approached.
