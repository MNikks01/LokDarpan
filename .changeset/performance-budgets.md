---
"@lokdarpan/web": minor
---

Measure the explorer's performance against its budgets, and load the map after the page is
interactive (ADR-062).

`perf:bytes` gzips `/explore`'s initial JavaScript from the build and fails over the 600 KB ceiling
(CI gate G7). `perf:runtime` drives a production server on desktop and throttled-mobile profiles and
reports medians and p75s against the budgets. The page marks `explorer:hydrated`, `map:init`,
`map:load` and `map:boundaries-drawn` for it.

MapLibre is now loaded with `next/dynamic` after hydration. Initial JavaScript for `/explore` falls
from 404.9 KB to 120.5 KB, and the rail becomes usable sooner on a throttled phone. The map itself
loads about half a second later there, still within budget.
