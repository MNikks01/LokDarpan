---
"@lokdarpan/database": minor
"@lokdarpan/web": patch
---

Draw a level from outlines simplified when they were loaded, and shade tenders without re-sending
the level (ADR-065).

Migration 0033 stores `geometry_overview`, each boundary simplified once. The level endpoint for
Madhya Pradesh falls from ~580 ms to ~62 ms. Containment now tests the stored label point and
requires a child to be smaller than its parent. That removes 79 pairs where a state or district was
listed as the child of one of its own smaller units.

Tender counts reach the map as feature-state, so the level's geometry is sent once per visit and a
department change moves only numbers.
