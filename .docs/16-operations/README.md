# 16 — Operations

Runbooks for what is deployed: the site on Vercel, the ledger on Neon, and the nightly tender
collection on GitHub Actions.

| Runbook                                                                      | What it covers                                                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [`deployment-vercel.md`](deployment-vercel.md)                               | The site: project settings, environment, base map, protection bypass, verification |
| [`provisioning-scheduled-ingestion.md`](provisioning-scheduled-ingestion.md) | The database: migrations, the ingestion credential, the first load                 |
| [`collection-schedule.md`](collection-schedule.md)                           | The nightly collection: schedule, credentials, monitoring, recovery                |
| [`rate-limiting.md`](rate-limiting.md)                                       | The API rate limit: the Firewall rule, the internal token, watching it             |
| [`tender-placement.md`](tender-placement.md)                                 | Placing tenders: the pincode directory, backfill, aliases, manual decisions        |
| [`raw-store.md`](raw-store.md)                                               | Where the bytes a row cites are kept: R2 setup, release order for migration 0037   |

Elsewhere:

- Deployment topology → [`../02-architecture/system-architecture.md`](../02-architecture/system-architecture.md)
- Monitoring and alerting → [`../13-observability/observability.md`](../13-observability/observability.md)
- Source re-verification cadence → [`../06-government-sources/source-quality.md`](../06-government-sources/source-quality.md)
- Permission requests to government bodies → [`../06-government-sources/permission-requests.json`](../06-government-sources/permission-requests.json)
