---
"@lokdarpan/ingestion": patch
---

Place a tender whose organisation chain names its district with the word "district" attached.

OpenStreetMap names many districts with the word in them (Manipur's are "Churachandpur district",
"Chandel district"), and some portals prefix it (Goa's chains read "District South Goa"). Compared
with the word left in, those never matched. Both sides now drop `district`, `dist`/`distt` and
`zila`/`zilla`/`jila` as whole words before the existing normalisation.

Checked against the production ledger: no two districts in any state collide under the new key, no
tender placed before loses its placement, and 2 of the unplaced tenders place, both in Goa. Most
unplaced tenders in the north-eastern states name no district at all, only state-level offices,
engineering circles or towns, and correctly stay unplaced.
