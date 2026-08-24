# ADR-011 — Web framework: Next.js (App Router) with RSC + ISR

**Status:** Accepted · 2026-08-24 · Supersedes the deferral of `.docs/02-architecture/tech-stack.md`'s frontend choice

## Context

`.docs/decisions/web-first-pivot.md` makes the website the first product. `.docs/02-architecture/tech-stack.md` originally chose Next.js App Router; the mobile-only phase discarded it. It now needs re-deciding on its merits rather than restored by default.

Requirements:

- **Indexability is existential.** With no app store, SEO is the acquisition channel (`.docs/02-architecture/tech-stack.md`). Every entity must be a server-rendered, crawlable page.
- **~10⁶ concurrent users at Phase 8** (`.docs/15-scalability/scalability-plan.md`), on grant funding — the read path must be cache-served, not computed per request.
- Read-only data publishing at most daily (`.docs/02-architecture/system-architecture.md` cron) — content is highly cacheable.
- Type sharing with `packages/api-contract` and the backend.
- Three locales including Devanagari.

## Decision

**Next.js (App Router), TypeScript strict, React Server Components for content, ISR keyed to `datasetVersion`, client components only for interactive islands.**

## Alternatives considered

**Astro.** Genuinely strong for this shape of product — content-heavy, mostly static, islands for interactivity, excellent default performance. Rejected on two grounds: the interactive surfaces (map, comparison builder, filterable tables, Ask) are substantial enough that "islands" stops being a simplification, and the React ecosystem depth we need (TanStack Table, MapLibre bindings, and eventual component sharing with React Native) is better served by a React-first framework. Astro would likely produce a _faster_ site; it would produce a _harder_ one to share code with the deferred mobile client.

**Remix / React Router 7.** Excellent data-loading model and web-standards alignment. Rejected narrowly: its strength is dynamic, per-request, mutation-heavy apps. This product is read-only and near-static — ISR fits it better than loaders that run on every request, and the caching story is the whole cost argument.

**SvelteKit.** Smaller bundles, pleasant DX. Rejected: abandons React, which forfeits type/component sharing with the future mobile app and the existing `.docs/01-product/design-system.md` component designs, for a benefit (bundle size) that RSC already largely delivers.

**Plain React SPA (Vite).** Rejected outright — **not indexable**, which fails the primary requirement. Everything else about it is irrelevant given that.

**Static site generation for all pages (no ISR).** Rejected: ~10⁶ admin units cannot be built ahead of time on every publish. ISR renders on first request and caches, which is the only tractable approach at that cardinality.

## Why RSC specifically

This is the decision that matters more than the framework name. Entity pages are **data-heavy and interaction-light** — a district page is a lot of numbers and a few links. Server Components render that content on the server, ship HTML plus almost no JavaScript, and keep the API client, the Zod schemas and the mappers entirely off the client bundle.

Consequences:

- The 90 KB initial-JS budget for entity pages (`.docs/02-architecture/web-architecture.md`) is achievable, not aspirational.
- The API contract layer never reaches the browser, so `packages/api-contract` can stay strict without bundle cost.
- Content is crawlable by construction rather than by a rendering workaround.

## Trade-offs

- **Vendor gravity.** Next.js is Vercel-led, and some features are best on Vercel. Mitigated: the app must remain deployable to a self-hosted Node runtime, and that must be verified in CI, not assumed. A public-interest project should not be unable to leave its host.
- **RSC complexity.** The server/client boundary is a real source of bugs. Mitigated by keeping the rule blunt: content is server, interaction is client, and the boundary is explicit at the component's top.
- **App Router churn.** Stabilised considerably, but still faster-moving than the rest of the stack. Pin versions; upgrade deliberately.
- **React overhead vs Astro/Svelte.** Accepted for ecosystem and future code-sharing.

## Consequences

- Every entity page is indexable and CDN-cacheable — the two things the pivot exists to buy.
- `datasetVersion`-tagged revalidation gives correct invalidation without time-based guessing (`.docs/02-architecture/web-architecture.md`).
- Component and type sharing with the deferred mobile client stays possible via `packages/ui` and `packages/api-contract`.
- Self-hosted deployability must be a tested property, not an assumption.
