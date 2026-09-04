---
"@lokdarpan/ingestion": patch
---

Read crore when the font mapping substituted its conjunct.

Document 3511 renders every `क` as `ि`, so its crore figures read `₹ 2.12 िोटी`
and were stored as ₹1 — wrong by seven orders of magnitude. Measured across the
corpus, the character before `ोट` when it follows a figure is `क` 2,027 times,
`ि` 21 times and absent 7 times; the observed forms are now listed, in the same
longest-first order that keeps intact spellings from changing identity.

Ten facts were mis-scaled. None had been published: the only decided one was
already rejected for a different defect found earlier.

This was found by a **review screen, not by the pattern** — money facts under
₹1 lakh with no rate qualifier are worth a person's eye, because a CAG report
rarely states a two-digit rupee finding unless it is a rate like "₹5 per record".
A font mapping this corpus has not yet shown will slip past the pattern too, and
that screen is what will catch it.

`PARSER_VERSION` is `cag-facts/8`.
