# ADR-078 · A private preview shows withheld material to the operator alone

**Status:** Accepted · **Date:** 2026-10-09 · **Amends** ADR-073 · **Builds on** ADR-056

## Context

Tender details and budget figures are collected but withheld: their publishers permit reproduction
only with permission, and none has been granted (ADR-073). The owner is designing the tender
experience — department categories on a map, and a full record for each tender — and cannot see
whether it works, or how it reads, while every field it shows is withheld. Publishing the material
"temporarily" was considered and refused: a public page is indexed and cached the moment it exists,
and publishing before asking weakens the request for permission.

Showing the material to the operator is not republication. Showing it to anyone else would be.

## Decision

1. **`internalPreview()`** (`apps/web/src/server/publishable.ts`) is true only when
   `LOKDARPAN_INTERNAL_PREVIEW` is exactly `"true"` **and** the code runs where the public cannot
   reach it: a local `next dev`, or a Vercel **preview** deployment. It is false on Vercel's
   production environment, and in any production build outside Vercel, whatever the switch says.
   Tests hold every production shape shut.
2. **In a preview, `decideFor` opens a withheld source on the basis `internal_preview`.** Nothing
   else changes: the same pages, the same routes, the same gate. The preview is therefore exactly
   what the public site will show once permissions arrive.
3. **A preview says so on every page** with a banner, and tells search engines to keep out
   (`robots: noindex, nofollow`).
4. **A preview deployment must be protected by Vercel Authentication** (Settings → Deployment
   Protection), so that only the project's members can open it. The switch is set for the Preview
   environment only, never for Production.

## Alternatives considered

- **Publish now, delete later.** This was refused: indexing and caching cannot be undone, and it
  would undercut the permission requests.
- **A separate "demo" build with fixture data.** This was rejected because it shows a product
  nobody will ship: the question is how real tenders read.
- **A login screen in the app.** This was rejected for now, because no authentication layer exists
  (ADR-021). Vercel's own protection already restricts preview deployments to the team.

## Consequences

- The publication gate has one more basis. Its rule — a restricted source never reaches the public
  without a recorded grant — is unchanged.
- Running the preview locally needs nothing but the switch in `.env.local`.
