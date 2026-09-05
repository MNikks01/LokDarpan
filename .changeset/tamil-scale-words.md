---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": patch
---

Refuse a figure whose scale word is in a script the parser cannot read.

Tamil Nadu's reports are published as separate Tamil and English PDFs. The Tamil
text layer arrives either in visual glyph order (`ணைாடி` where Unicode spells
`கோடி`) or as mojibake (`ேகா}`), and both keep the digits while destroying the
word beside them: the state's revenue receipts, `₹2,43,749.34` crore, were read
as `₹2,43,749`.

An unqualified amount whose next word is in neither English nor Devanagari is
now refused rather than read as rupees. Verified against every decision already
recorded — the same facts are stranded with the rule and without it, and the
published ledger is unchanged.

`page_script` gains `tamil`; 730 pages of Tamil had been stored as English
because they carry page numbers and roman numerals.

Also: an HTML entity in a report link is decoded (`&#039;` in "CAG's Report" made
one URL unfetchable), and one report that will not fetch no longer ends the run.
