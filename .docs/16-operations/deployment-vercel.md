# Deploying to Vercel

The decision and its trade-offs are in [`../adr/020-vercel-deployment.md`](../adr/020-vercel-deployment.md). This is the runbook.

## One deployment

`apps/web` serves both the site and `/api/v1/*`. There is no second service to deploy.

## 1. Database — Neon

Add Neon from the Vercel Marketplace, or create a project at neon.tech and copy the connection string.

**Use the pooled endpoint.** A serverless isolate opens its own pool; the direct endpoint exhausts a free tier's connection cap under modest traffic. Neon's pooled host contains `-pooler`.

Then, once, from a machine that can reach the database:

```bash
DATABASE_URL='<neon owner connection string>' \
  pnpm --filter @lokdarpan/database migrate

psql '<neon owner connection string>' -f database/scripts/create-local-api-user.sql
```

The second command creates the login user the site connects as. **Change the password** — the one in that file is local-only. In a deployed environment, create the user with a managed secret instead and grant it `lokdarpan_readonly`.

## 2. Environment variables

| Variable       | Value                                   | Notes                                                                            |
| -------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL` | Neon **pooled** URL for `lokdarpan_api` | **Must be the read-only user.** ETL is the only write path; see migration `0002` |
| `API_BASE_URL` | _unset_                                 | Only set to point at a separately hosted `services/api`                          |

Do **not** put the owner credential here. The web deployment must never be able to write to the ledger.

## 3. Project settings

`apps/web/vercel.json` carries the build configuration and the security headers. Its build command
runs `geo:fetch` before `next build`: the explorer's boundary geometry is generated from the ledger,
using the deployment's read-only `DATABASE_URL`, and is not committed. `next.config.ts` names
`public/geo/manifest.json` in `outputFileTracingIncludes`, because `/explore` reads it from disk at
runtime.

The defaults only need:

- **Framework preset:** Next.js
- **Root Directory:** `apps/web`. Vercel reads `vercel.json` from the Root Directory, and at the
  repository root it detects `services/ocr` as a second service and offers an "Other" multi-service
  preset, which is wrong: the OCR service is not deployed to Vercel.
- **Include files outside the Root Directory:** on (the default). The app builds from the workspace
  packages in `packages/`; install still runs at the repository root, where the lockfile is.
- **Output Directory, Build and Install commands:** no overrides. `vercel.json` sets the commands,
  and Next.js's output is `.next` inside the Root Directory. Overriding the output directory to
  `apps/web/.next` fails the deployment after "Collecting build traces", because the path is then
  counted from `apps/web`.

## 4. Ingesting data

**Not from Vercel.** ETL needs the owner credential, and putting it in the web project's environment would place write access beside the public site.

Run it from a trusted environment:

```bash
DATABASE_URL='<owner connection string>' \
  pnpm --filter @lokdarpan/ingestion ingest:lgd
```

## Observability

Vercel captures stdout, and the service writes one structured JSON object per line with `service`, `version` and `env` — so filtering works without parsing messages.

**`/metrics` is not served here.** In-memory counters cannot survive an isolate that is frozen between invocations, and a scrape would reach one arbitrary instance. `services/api` serves it for the self-hosted shape, where it is correct.

## Verifying a deployment

```bash
curl -s "$URL/api/v1/units?level=state" | head -c 200   # 36 units, one datasetVersion
curl -s "$URL/units/20"                                  # a unit page with provenance
curl -si "$URL/api/v1/units/999999" | head -1            # 404, not a 500
```

If the first returns `INTERNAL`, the usual cause is `DATABASE_URL` pointing at the direct rather than pooled Neon endpoint, or at a user without `SELECT`.

## Leaving Vercel

Deploy `services/api` and set `API_BASE_URL` to it. The Route Handlers become unused rather than blocking — the escape hatch [`../adr/011-web-framework.md`](../adr/011-web-framework.md) requires.
