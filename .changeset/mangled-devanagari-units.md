---
"@lokdarpan/ingestion": minor
---

Ingest seven more CAG reports, and fix three defects they exposed — two of which
had already published wrong figures.

The corpus went from 3 documents and 1,091 pages to 10 and 2,792. Some of these
PDFs map glyphs through a non-Unicode font, so their text layer extracts as
mojibake: Latin letters and digits stand in for Devanagari conjuncts, and matras
detach from their stems.

**`RS` was read as a currency marker.** These reports index their own series with
all-caps codes — GSS, ES, RS, COPU — so a table of PAC/COPU report numbers
produced ₹916, ₹33, ₹37, ₹54 and ₹56 out of report numbers. Across 2,792 pages
every `RS` before digits is a series code and no genuine `Rs.` currency marker
exists; these reports write `₹`. The marker is now case-sensitive. Five of these
fabrications had been verified and published, and are revised to rejected.

**A crore stem whose matra did not survive** was not recognised, so 721 figures
were read as bare rupees — wrong by seven orders of magnitude. The mapping
produces `कोट2`, `कोट8`, `कोट-`, `कोट:` and detaches the matra behind a space.
One of the 721 was published, and was also an appendix heading rather than a
reported amount; both the unit match and the criterion screen missed it for the
same reason and both are fixed.

Ordering matters here: matching the bare stem first shortened every intact
`कोटी` match, moved every evidence window and stranded 504 sound decisions. The
intact spellings are listed first, and stranding fell to 6 — the facts that were
actually wrong.

`PARSER_VERSION` is `cag-facts/7`. All 1,573 published money facts were audited
for both defects: 0 fabricated, 0 mis-scaled.
