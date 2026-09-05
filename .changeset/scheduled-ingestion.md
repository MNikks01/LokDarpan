---
"@lokdarpan/ingestion": minor
"@lokdarpan/database": minor
---

Schedule the GEP-NIC sweep daily, under a credential that can only ingest.

A sweep exited 0 whatever happened. Refusals were counted and named in the
summary and never reached the exit code, so a day on which every portal refused
looked to a scheduler exactly like a day on which everything worked. A sweep in
which every attempted portal refused now exits 69; some refusing while others
collect stays a success, because those records are real and a workflow that went
red for one portal in twenty would stop being read.

`lokdarpan_etl` is the role the scheduler runs as, derived by reading every
statement the pipeline issues rather than by removing privileges from ownership.
It may read the hierarchy and tender history, and write tenders, their collection
windows and ingestion runs. It cannot change the schema, create objects, or write
tender history directly — that is the SECURITY DEFINER trigger's job, and
granting it here would have defeated the point of making it one.

One sweep at a time, enforced by a PostgreSQL advisory lock on key 437642, taken
on the connection that runs the sweep so the server releases it when the process
dies. No stale lock, no timeout. A sweep that cannot take it records an
`ingestion_run` with the new `skipped` status, naming the backend that holds it,
and exits 75 — neither a failure nor a success, which the previous three statuses
could not express.

Maharashtra tender ingestion remains `not_collected`. Scheduling changes what the
other twenty states report; it does not make Maharashtra data available.
