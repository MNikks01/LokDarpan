# The private preview

**Written:** 9 October 2026 · **Decision:** [ADR-078](../adr/078-a-private-preview-shows-withheld-material-to-the-operator.md)

The preview shows tender and budget details that the public site withholds until the issuing
departments give permission. Only you should ever see it.

## On your own machine

Add to `.env.local`, then start the site:

```bash
LOKDARPAN_INTERNAL_PREVIEW=true
```

```bash
pnpm dev
```

Every page shows a dark banner saying it is a private preview. If you do not see the banner, the
preview is off.

## On a Vercel preview deployment

1. In the Vercel project, open **Settings → Deployment Protection** and check that **Vercel
   Authentication** is on for **Preview** deployments. Without it, anyone with the link could open
   the preview. Do not continue until it is on.
2. In **Settings → Environment Variables**, add `LOKDARPAN_INTERNAL_PREVIEW` = `true` and tick
   **Preview** only. **Never tick Production.** (The code refuses to open in production anyway, but
   the variable should not be there.)
3. Open any pull request's preview link while signed in to Vercel. Look for the banner.

## What it does not do

It does not publish anything, change the database, or affect the public site. Removing the variable
turns it off.
