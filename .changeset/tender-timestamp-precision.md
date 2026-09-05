---
"@lokdarpan/database": patch
---

Stop a timestamp that lost precision in transit from looking like a changed
tender.

PostgreSQL stores timestamps to the microsecond and a JavaScript `Date` carries
milliseconds, so a caller reading a closing date back and writing it again
unchanged handed over `12:00:00.123` where `12:00:00.123789` was stored. The
versioning trigger compared exact values, saw a difference, and would have
recorded a government office moving a deadline it never touched. ADR-049 shipped
with this as a known limitation; ADR-050 closes it.

Where two readings agree to the millisecond, the stored value is now restored
before any comparison — so the comparison itself is unchanged, a real change of a
millisecond or more still files a version, and the stored microseconds survive
the round trip rather than being quietly shortened.

Declaring the column `timestamptz(3)` was the obvious fix and is wrong: that cast
rounds `.123789` to `.124` while the driver truncates it to `.123`, leaving the
two unequal. `date_trunc('milliseconds', …)` truncates, matching the driver.
