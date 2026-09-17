---
"@lokdarpan/domain": minor
"@lokdarpan/web": minor
---

Describe collection, currency and completeness in one data-state model.

Tender collection and geography coverage each had their own status vocabulary, and each folded
independent facts into one value. `DataState` answers three questions separately: is it collected,
is it current, is it whole. One precedence rule gives a panel its headline, and `mayShowCounts`
allows a count only for data that is collected.

Boundaries report `held` rather than `current`, because nothing schedules them. There is no "not
published" state until something records the evidence one would need.

The tender overview gains `collectionState` and each coverage entry gains `state`; existing fields
are unchanged. No reader-facing wording changes in this release.
