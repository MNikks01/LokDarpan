---
"@lokdarpan/web": minor
---

Carry layers and the department filter in the explorer's URL, and let a reader copy a link that
names the dataset version (ADR-061).

`layers=` (tokens `so`, `cb`, `pn`, or `none`) and `dept=` are written only when they differ from the
defaults. "Copy link to this view" adds `v=`, the dataset version the view was drawn from. The server
drops a version the ledger does not hold. Opening a pinned link says whether what is shown is that
version or a later one. Any navigation drops the pin.

"Up one level" from a district now returns to the state view instead of selecting the state's own
unit.

New sentences, for review:

- "Copy link to this view"
- "Link copied. It names the dataset version this view was drawn from."
- "The link could not be copied here. Select it below and copy it."
- "This link was made from dataset version {v}, opened {date}. What is shown is that version."
- "This link was made from dataset version {v}, opened {date}. LokDarpan has loaded data since, and
  what is shown is version {current}. Earlier versions of boundaries and counts are not kept, so
  this may differ from the view that was shared."
