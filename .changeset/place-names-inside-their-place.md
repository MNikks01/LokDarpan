---
"@lokdarpan/web": minor
"@lokdarpan/database": minor
"@lokdarpan/domain": minor
---

Draw each place's name inside the place, and stop names flickering.

Names were anchored at the middle of a unit's bounding box, which for a coastal district or a
crescent-shaped taluka can be in the sea or a neighbouring unit, and overlaps were ranked by
bounding-box area in square degrees. Migration 0032 adds `label_point`, the centre of the largest
circle inside the unit, and `area_m2` as generated columns, and boundary features now carry both.

Placement is decided by a neutral arbiter: selection, administrative level, and area bucketed by
powers of two, with nothing from a place's records. A just-shown name holds for 600 ms and a hidden
one waits 400 ms, so names no longer flicker at the edge of a collision. Collision tests use a
spatial grid, and names are measured in one batch.

Names stay as DOM text because MapLibre 5.24 cannot shape Devanagari, Tamil or other Indic scripts.
Their visibility is written inside the marker, because MapLibre resets a marker's own opacity on
every move, which had redrawn hidden names on top of each other.
