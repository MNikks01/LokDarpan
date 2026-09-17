---
"@lokdarpan/web": minor
"@lokdarpan/domain": patch
---

Say what LokDarpan holds in the reviewed wording, from one place.

The tender and boundary panels now read the shared data-state model instead of their own status
fields, and every sentence about the state of data lives in `apps/web/src/copy/data-state.ts`.
Five sentences changed, each reviewed before release:

- A failed tender request says it "could not be loaded just now. This is a fault here, not a
  statement about any portal." "Unavailable" could be read as a portal withholding data.
- Stale tenders give the date they were last collected, instead of "more than two days ago", which
  duplicated a code constant.
- An empty tender list states when collection began, instead of "Collection began recently", which
  stops being true.
- A partially held level says "Not every municipal body is held." rather than "coverage is
  incomplete", which could be read as a gap on the government's side.
- A portal registered but never collected successfully says "LokDarpan has no record of checking
  its e-procurement portal for {state}" and shows no count, where it previously showed a zero.

A boundary level marked not collected now keeps the note recorded with it.
