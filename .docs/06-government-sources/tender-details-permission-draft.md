# Draft — request to an issuing department for permission to show its tender details

**Status:** Template for the maintainer to adapt, complete and send · 25 September 2026
**Registry:** `permission-requests.json` → `gepnic-issuing-departments` · **Decision:**
[`../adr/056-a-tender-is-linked-to-not-reproduced.md`](../adr/056-a-tender-is-linked-to-not-reproduced.md)

The GePNIC portals' terms put permission with **each issuing department**, not with the portal
operator (Madhya Pradesh requires it in writing). So this is one letter per department, not one
letter per state. Until a department grants it, its tenders are counted and linked to, never
reproduced.

## Before sending

1. **Start where it matters most.** The explorer's `departments()` list gives the departments with
   the most open tenders per state; begin with those.
2. **Confirm each addressee** from the department's own website, read in a browser. Record each
   letter as its own entry in `permission-requests.json` when sent, with date and reference.
3. **Do not overstate the project.** Pre-launch, non-commercial, no commercial backing.

## Draft letter

> To,
> [**The officer responsible for e-procurement**, verified from the department's site]
> [Department], Government of [State]
>
> **Subject:** Request for permission to reproduce tender notices published by the [Department] on
> [portal]
>
> Respected Sir/Madam,
>
> The terms of use of [portal] state that its content may be reproduced with the permission of the
> respective department. I am writing to request that permission for tender notices published by
> the [Department].
>
> LokDarpan is a non-commercial public-interest platform that shows where public works are being
> advertised, drawn only from official records and always linked to the notice on the portal. It
> presents facts only; it does not allege wrongdoing and does not rank or score any bidder, firm or
> office.
>
> I request permission to show, for each open tender, its title, reference, closing date, issuing
> office, location, estimated value and EMD as published, with attribution to the [Department] and
> a link to the notice on [portal].
>
> Yours faithfully,
> [Name] · [Contact] · LokDarpan
