# 21 — Deep Linking

Deep links are how an investigation travels: a journalist sends a project link to an editor, an activist attaches one to an RTI, a citizen shares a village's accounts in a WhatsApp group. Because there is **no website** (`00-document-audit` §3), links are also the *only* stable public address for a record — which raises their importance rather than lowering it.

---

## Two schemes

| Scheme | Form | Use |
|---|---|---|
| **Universal / App Links** (primary) | `https://lokdarpan.org/project/501` | Everything shared. Verified domain association means no other app can claim it; opens the app if installed, otherwise a store-redirect page |
| **Custom scheme** (secondary) | `lokdarpan://project/501` | In-app navigation, notifications, QR codes, and contexts where an `https` link would be intercepted |

Both resolve through the **same route table** — Expo Router's file tree *is* the link table (`adr/002-navigation.md`), so there is no second mapping to drift.

### The "no website" question, answered honestly

Universal links require a domain serving `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`, plus something for a browser that follows the link without the app installed.

**Decision:** `lokdarpan.org` serves the two association files and **one static redirect page per entity type** — title, the entity's name, the neutrality statement, and store buttons. It renders no figures, no observations, and no data.

That is link infrastructure, not a product surface, and it does not reintroduce the web app the brief excludes. It is recorded as an explicit assumption (`00-document-audit` A6) because it requires a domain and a minimal host, and both should be confirmed rather than assumed.

---

## URL space

```text
https://lokdarpan.org/...          lokdarpan://...

  /                                          → Home
  /unit/{id}                                 → S-23   the canonical place link
  /unit/{id}/consistency|peers|coverage|observations|children
  /project/{id}                              → S-27   the canonical project link
  /project/{id}/finance                      → S-28
  /project/{id}/finance/ledger/{kind}        → S-29   kind ∈ allocations|releases|expenditures
  /project/{id}/observations/{observationId} → S-35
  /project/{id}/priority|timeline|progress|intelligence|location
  /project/{id}/compare?with={id},{id}       → S-38
  /tender/{id} · /contractor/{id} · /contractor/{id}/tenders
  /scheme/{id} · /department/{id}
  /source/{docId}                            → S-53
  /source/{docId}/document?page=42           → S-54   page-anchored
  /source/{docId}/lineage?figure={figureId}  → S-55
  /sources                                   → S-56
  /search?q=&types=&unitId=&fy=&filters=     → S-14   a shareable investigation
  /ask?scope={unitId}&fy=&q=                 → S-58   scope only; q is prefilled, never auto-sent
  /coverage · /methodology · /legal          → S-77 · S-76 · S-74

Aliases (redirect to the canonical /unit/{id}):
  /district/{id} · /village/{id} · /state/{id} · /taluka/{id} · /ward/{id} · /local-body/{id}
```

**Why aliases exist and why they redirect.** The brief lists `lokdarpan://district/{id}` and `lokdarpan://village/{id}`. These are accepted for readability and for links already in circulation, but they resolve to the single canonical `/unit/{id}` route — because `.docs/05-data-model/database-design.md`/`.docs/03-domain/administrative-hierarchy.md` model every level as one `admin_unit`, and two route families for "a place" would recreate the `district`/`admin_unit` duality that `00-document-audit` C7 identifies as a maintainability trap.

**LGD codes as an alternative key** ★: `/unit/lgd/{lgdCode}` is a requested addition. LGD codes are the government's own cross-source identifier (`.docs/03-domain/administrative-hierarchy.md`) and are stable across our internal id changes — which makes them the right thing to print in an article or an RTI application.

---

## The synthetic back stack

A deep link must never land a user on a screen whose back button exits the app.

```text
Open  lokdarpan://project/501
   ↓ resolve the entity (it returns its ancestor chain)
Build:  Home  →  unit/7 (Pune)  →  unit/412 (Baramati)  →  project/501
   ↓
Back walks UP the hierarchy — matching the mental model of the data
```

The chain is taken from the entity payload's `ancestors`, so it is real, not guessed. If the entity cannot be resolved (offline, deleted, invalid), the stack is `Home → error screen`, never a broken half-state.

---

## Cold vs. warm

| Case | Behaviour |
|---|---|
| **Cold** | Bootstrap (S-01) runs first — locale, scope, cached data. The link is held and applied after rehydration, so the target screen has theme, language and cache available. Onboarding is **not** skipped for a first-time user; the link is queued and applied after S-02–S-05, so a shared link never bypasses the neutrality framing (`.docs/01-product/screen-inventory.md` S-02) |
| **Warm** | Pushed onto the *current* tab's stack, preserving what the user was doing |
| **Already on target** | Route params updated in place; no duplicate push |
| **Offline** | Cached or saved → renders with the offline bar. Not cached → `OfflineUnavailable` with the entity type named ("This project hasn't been downloaded"), retry, and save-for-later |
| **Unresolvable id** | "This record is no longer in the published dataset. It may have been superseded or removed by the source." + search |

---

## Validation and security

Every link is untrusted input from an unauthenticated source.

```ts
const ProjectLink = z.object({
  id: z.string().regex(/^\d{1,12}$/).transform(Number),
  fy: z.string().regex(/^FY\d{4}-\d{2}$/).optional(),
});
```

Rules (`.docs/12-security/mobile-security.md` §6):

1. **Every parameter is schema-validated** before routing. A malformed link lands on "link not recognised", never on a partially-initialised screen.
2. **IDs only, never payloads.** A link carries an identifier; the app fetches the record. No figure, name, or observation is ever rendered from link content — otherwise a crafted link could display a fabricated government figure inside the app, with the app's credibility attached to it. This is the single most important rule here.
3. **No action links.** No deep link can save, unsave, delete, sign in, change a setting, grant a permission, download a document, submit a report, or send an AI question. `?q=` on `/ask` prefills the composer; the user still presses Ask.
4. **No open redirect.** No link parameter can cause the app to open an arbitrary external URL. Document URLs go through the source-registry host allow-list.
5. **Universal links preferred** over the custom scheme — verified domain association cannot be hijacked by another installed app.
6. **Rate-limited** to prevent a link-flood loop.
7. **Fuzz-tested** in CI with malformed, oversized, injected, and unicode-confusable links (`.docs/14-testing/testing-strategy.md`).

---

## Sharing from the app

Every entity screen has Share, producing:

```text
Upgradation of ODR-14, Baramati — LokDarpan
Rural road · Pune district · FY2024-25
Allocated ₹10.00 cr · Released ₹9.00 cr · Utilized ₹8.00 cr
Figures from official records. Every number links to its source.
https://lokdarpan.org/project/501
```

Constraints, from `.docs/17-legal/legal-ethical-rules.md`:
- The share text carries **figures and the link**, never an observation, a verification-priority score, or an AI-generated sentence. A score pasted into a group chat without its factor breakdown is exactly the decontextualised judgment `.docs/08-risk/risk-scoring-engine.md` exists to prevent.
- The line *"Figures from official records"* is mandatory in every share payload.
- No screenshot generation, no chart-to-image export (`.docs/01-product/screen-inventory.md` §Screens that must not exist) — an image separates a number from its provenance.
- "Share evidence" (S-35) is the richer artefact: observation text, every input figure **with source URL, confidence and `asOf`**, the `datasetVersion`, and the standing disclaimer.

---

## Platform configuration

**iOS** — Associated Domains `applinks:lokdarpan.org`; AASA served from `/.well-known/` as `application/json`, no redirect; custom scheme `lokdarpan` registered.
**Android** — App Links intent filters with `android:autoVerify="true"`; `assetlinks.json` with the release signing-key fingerprints (debug and release both listed, so verification works in QA); custom scheme registered.
**Expo Router** — `scheme: "lokdarpan"`, `origin: "https://lokdarpan.org"`; routes are the link table.

Verification is checked in CI (the association files are fetched and validated on every release) and manually on both platforms pre-release — silent App Links verification failure is a classic launch defect that only shows up on real devices.

---

## Notifications and QR

Local notifications (`.docs/10-mobile/notifications.md`) carry a deep link to the changed entity, **anchored to the changed section** — `lokdarpan://project/501/finance?highlight=expenditure`. The `highlight` parameter scrolls and outlines a section; it never injects content.

QR codes on printed material (a panchayat notice board, an RTI response) use the `https` form so they work with or without the app.

---

## Testing

Cold and warm open for every route family · synthetic back stack asserted for a 4-deep entity · malformed/injected/oversized parameter fuzzing · offline open with and without cache · unresolvable id · alias → canonical redirect · App Links verification on a real device (both platforms) · first-run link queued behind onboarding · share payload asserted to contain no observation, score, or AI text.
