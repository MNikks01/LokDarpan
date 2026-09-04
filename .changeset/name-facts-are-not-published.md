---
"@lokdarpan/ingestion": patch
---

Withhold contractor and officer name facts from publication, and stop capturing
a firm name that was cut mid-way.

The last 37 unreviewed candidates were 2 contractor references and 35 officer
role references. Each is a name and the sentence it was found in, and both
contractor references sit inside audit observations about insurance
non-compliance. `.docs/17-legal` rule 1 confines names to "neutral, descriptive
statistics", and a name paired with an audit observation is not one — the
pairing draws the inference without anything being editorialised. No screen is
designed for them either; they render as a generic "Firm named" / "Role named".

They are rejected as a class rather than judged individually, because the reason
is not that these particular readings are wrong. Extraction continues, so the
evidence stays available to a future surface designed for it.

One extraction defect is fixed rather than merely rejected. The page names a
joint venture, "M/s Water Staywordship Organization J.V Baramati"; the capture
stopped at the full stop in "J." and the trimmer kept the head of it, naming one
partner instead of the venture. `trimToName` now captures nothing when a
trailing initial shows the name was cut — a missed firm costs a reviewer
nothing, a misnamed one attaches the wrong company to a public claim.

`PARSER_VERSION` is `cag-facts/6`. The review queue is empty.
