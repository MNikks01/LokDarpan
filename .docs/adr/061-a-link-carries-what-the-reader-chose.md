# ADR-061 · A link carries what the reader chose, and says which ledger it came from

**Status:** Accepted · **Date:** 2026-09-23 · **Implements** phase 7 of [`../decisions/gods-eye-view-adoption.md`](../decisions/gods-eye-view-adoption.md) · **Builds on** [`053-every-explorer-payload-states-its-dataset-version.md`](./053-every-explorer-payload-states-its-dataset-version.md), [`058-a-map-layer-is-a-definition-not-an-effect.md`](./058-a-map-layer-is-a-definition-not-an-effect.md)

## Context

The explorer's URL carried the state, the unit and the open document. Which layers were drawn and which
department the tenders were narrowed to lived in `useState`, so a shared link lost both. A journalist
who hid the area boundaries and narrowed to one department sent a link that opened with everything
back on.

The adoption plan also asked for a version pin: a link that names the ledger it was made from. The
ledger cannot serve an older version. `admin_unit_boundary` is keyed by unit, so a reload overwrites a
boundary, and tender counts are computed live. The open item offered two options: version the
boundary rows, or say so on the page.

## Decision

**Layers and the department are in the URL.**

- `layers=` lists the visible toggles by stable token (`so`, `cb`, `pn`, defined beside the toggles in
  `map/layers/visibility.ts` and matching the registry's `urlToken`s). It is omitted when the layers
  are the defaults, so an ordinary link stays short, and `none` means every layer is hidden.
- Unknown tokens are dropped. A list with no known token falls back to the defaults, so a link from a
  later version of the site opens with the default layers, not a blank map.
- `dept=` is bounded at 200 characters because it reaches a query. Changing state clears it, since the
  department list is the new state's (ADR-056 scoping, commit `b65fd64`).

**A version is pinned only on request.** "Copy link to this view" writes the current watermark as
`v=`. The address bar never carries one: a reader who copies it shares a place, and one who uses the
button shares a place as LokDarpan held it. Any navigation drops the pin, because the view is no longer
the one the version describes.

**The ledger is not versioned for this. The page says so instead.**

- The server checks a pin against `dataset_version`. A version it does not hold is dropped, and the
  link opens as an ordinary one.
- When the pinned version is the one being shown, the page says so.
- When the ledger has moved on, it names both versions and when the pinned one was opened. It also
  says that earlier boundaries and counts are not kept, so the view may differ from the one shared.

Versioning boundary rows would cost a migration, a history table and a query per read. The pin's
first use is attribution: which data did this screenshot come from? That needs the version's
identity and date, not a replay.

**"Up one level" from a district now clears the unit** instead of selecting the state's own row. The
old behaviour put `unit=<state>` in the URL and downloaded the state's detailed outline, which ADR-064
had kept out of the level payload.

## Consequences

`explorer-url.test.ts` covers:

- a round trip of layers, department and pin;
- default layers omitted;
- `none`;
- unknown tokens;
- bounded departments;
- version parsing;
- dropping a pin the ledger does not hold.

Checked in headless Chromium against the local ledger:

- A link with `layers=so,pn&dept=…` restored both checkboxes and the department, and the overview
  request carried the department.
- Turning area boundaries back on removed `layers` from the URL.
- The copied link carried `v`, and opening it showed the same-version notice.
- Selecting a unit dropped the pin and its notice.
- "Up one level" returned to `?state=23`.
- `v=101` showed the changed-version notice with both versions and 25 Aug 2026.
- `v=999999999` showed no notice.

The seven existing explorer e2e tests pass unchanged.

**Not in this change:**

- **Replaying an older version.** If it is ever needed, it means versioned boundary rows and
  as-of reads throughout.
- **Selections of kind `tender`.** Tender details are withheld (ADR-056), so there is no tender view
  to select.
- **Correcting the address bar when the server drops a pin or a unit.** The page renders the
  corrected state; the URL catches up on the reader's first action, as it already did for `reconcile`.
