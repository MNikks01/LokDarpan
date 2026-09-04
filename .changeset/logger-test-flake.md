---
"@lokdarpan/api": patch
---

Stop the redaction test failing on its own timestamp.

`REDACTS anything that could leak what a user investigates` asserted that the
emitted line does not contain `18.5`, the latitude it feeds the logger. The line
also carries an ISO timestamp, and one emitted in second 18 with milliseconds
`5xx` reads `…T17:29:18.567Z` — which contains `18.5`.

Roughly one run in six hundred, therefore, the test failed and pointed at
redaction, which was working the whole time. It failed three times in one
afternoon.

The substring check now runs over the payload with the timestamp removed, and the
timestamp is asserted separately for its shape. The test still checks that no
field leaks anywhere in what is written.
