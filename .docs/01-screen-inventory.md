# 01 — Screen Inventory

Every screen the mobile product requires, with its purpose, data, states, and instrumentation. Screens carry stable IDs (`S-nn`) used by `.docs/19-screen-api-matrix.md`, `.docs/20-screen-data-matrix.md`, and the wireframes.

## How to read a screen block

```text
Purpose      what this screen exists to do (one sentence)
User         primary persona (see 01-PRD)
In / Out     entry points / exit destinations
Do           primary action · secondary actions
Data         domain entities required
API          endpoints (see 18-mobile-api-contract.md; ★ = new backend requirement)
States       Loading / Empty / Error / Offline
Perms        OS permissions required
Events       analytics events emitted (see 16-observability.md)
```

**Surface types.** `screen` = full route in the navigation stack · `sheet` = bottom sheet over the current screen · `modal` = full-screen presented modally · `overlay` = transient in-place surface.

---

## A · Launch, onboarding, permissions

### S-01 · Bootstrap (`screen`, no chrome)
- **Purpose** Restore persisted state, resolve locale, check client-support, decide first-run vs. resume. Not a "splash animation" — a real gate.
- **User** All. **In** cold launch, deep link. **Out** → S-02 (first run) · S-10 (returning) · S-06 (forced upgrade)
- **Do** none (non-interactive) · retry on bootstrap failure
- **Data** persisted scope, locale, onboarding flag, client-support manifest
- **API** `GET /meta/client-support` ★ (2s timeout, cached, non-blocking on failure)
- **States** L: brandmark, no spinner before 400ms · E: n/a · Err: proceed with cached config; never block launch on network · Off: proceed from cache
- **Perms** none · **Events** `app_launched{cold, resume, deeplink}`
- **Note** Bootstrap must never block on the network. A user on a dead connection must reach cached content.

### S-02 · Onboarding — "What this is" (`screen`, 3 panels)
- **Purpose** Establish the neutrality frame **before** the user sees a single variance. This is a legal-ethical control surface, not marketing.
- Panel 1: *what LokDarpan does* — follows official money, links every number to its government source.
  Panel 2: **what it does not do** — verbatim from `docs/15` §Positioning: *"A difference or gap shown here means the data warrants a closer look — it is not a claim of wrongdoing by any person or organization."*
  Panel 3: *how to verify* — a live demo of tapping a figure → source sheet → document page.
- **User** All. **In** S-01 first run · Settings → "Replay introduction". **Out** → S-03
- **Do** Continue · Skip (Skip still shows Panel 2 as a non-dismissible card)
- **Data** none (fully offline, bundled) · **API** none
- **States** all n/a (static) · **Perms** none
- **Events** `onboarding_viewed{panel}`, `onboarding_completed{skipped}`

### S-03 · Language selection (`screen`)
- **Purpose** Choose English / मराठी / हिन्दी. Pre-selected from device locale.
- **In** S-02 · Settings. **Out** → S-04
- **Do** select + continue · **Data** bundled locale list · **API** none
- **States** n/a · **Perms** none · **Events** `language_selected{locale, was_device_default}`

### S-04 · Location primer (`screen`)
- **Purpose** Explain *why* location is wanted before the OS dialog, and offer a first-class manual alternative. The OS prompt is never fired blind.
- Copy states plainly: coordinates are used to find nearby records and are never stored or linked to you (`.docs/13-mobile-security.md`).
- **In** S-03. **Out** → OS prompt → S-10 · "Choose my area instead" → S-05 · "Not now" → S-10 (national scope)
- **Do** Allow · Choose manually · Not now
- **Data** none · **API** none
- **States** Perm-denied: no dead end — falls through to S-05
- **Perms** requests `WhenInUse` location · **Events** `location_primer_shown`, `location_permission_result{granted, source}`

### S-05 · Choose your area (`screen`)
- **Purpose** Manual scope selection: State → District → (optional) Taluka/Local body. The permanent equal of location permission, not a fallback.
- **In** S-04 · S-09 · Settings. **Out** → S-10
- **Do** select unit · search within picker · "Use my location instead"
- **Data** `AdminUnit` tree (levels nation→taluka) · **API** `GET /units/:id/children`, `GET /search?type=unit` ★
- **States** L: level skeleton · E: "No sub-units published for this unit yet" · Err: retry + fall back to bundled state/district seed list · Off: **bundled state+district list ships in the binary** so scope selection always works offline
- **Perms** none · **Events** `scope_selected{level, method}`

### S-06 · Forced upgrade (`modal`, blocking)
- **Purpose** Block a client below the minimum supported build. Only ever triggered by a genuine contract break.
- **In** S-01, or any `426`/`upgrade_required` API response. **Out** → store listing (no dismiss)
- **Data** client-support manifest · **API** `GET /meta/client-support` ★
- **States** Off: **still dismissible to cached content** — never strand a user offline behind an upgrade wall
- **Events** `forced_upgrade_shown{current_build, min_build}`

### S-07 · Notification primer (`sheet`)
- **Purpose** Contextual, deferred permission ask — fired only the first time a user saves an item, never at launch.
- **In** S-62 first save. **Out** dismiss → back to save confirmation
- **Do** Enable updates · Not now · **Perms** requests notifications
- **Events** `notif_primer_shown{trigger}`, `notif_permission_result{granted}`

---

## B · Home & scope

### S-10 · Home (`screen`, tab 1)
- **Purpose** Answer *"what public money is around me, and what should I look at?"* — an intent launcher, **not** a KPI dashboard.
- Composition (top→bottom): scope chip header · **Near you** (count + money summary + map peek) · **Your area this year** (the four-panel level-agnostic summary for the current scope unit) · **Continue** (recently viewed) · **Worth verifying in <scope>** (max 3, scoped, never a feed) · **Ask about <scope>** entry · coverage note.
- **User** Citizen (primary), all others secondarily. **In** tab bar · S-01 · deep link fallback. **Out** → S-23 · S-27 · S-17 · S-58 · S-12 · S-11 · S-68
- **Do** open scope summary · secondary: change scope (S-09), change FY (S-08), notifications (S-11), settings (S-68), pull-to-refresh
- **Data** `AdminUnit` + `Finance` rollup, nearby counts, recent-view list (local), top observations, coverage
- **API** `GET /mobile/home?unitId&fy&lat&lon` ★ (single composite; see `18` §BFF)
- **States** L: section skeletons, header renders immediately from persisted scope · E: "No records published for <unit> in <FY> yet" + FY switch + parent-unit link · Err: inline per-section error, other sections still render · Off: full cached render + persistent offline bar, `asOf` shown
- **Perms** location (optional; degrades to scope-unit-only) · **Events** `home_viewed{scope_level, has_location}`, `home_section_opened{section}`

### S-08 · Fiscal year selector (`sheet`)
- **Purpose** Change FY globally; the scope persists across the whole app.
- **In** any header FY chip. **Out** dismiss (applies immediately)
- **Data** `FiscalYear[]` + per-FY coverage indicator ("partial data") · **API** `GET /meta/fiscal-years` ★
- **States** L: skeleton rows · Off: cached list; years with no cached data are marked, not hidden
- **Events** `fy_changed{from, to}`

### S-09 · Scope switcher (`sheet`)
- **Purpose** Change "my area" without leaving the current screen. Recents + saved units + "use my location" + "browse hierarchy."
- **In** header scope chip on any tab. **Out** dismiss · → S-05 · → S-22
- **Events** `scope_changed{from_level, to_level, method}`

### S-11 · Updates inbox (`screen`)
- **Purpose** Chronological list of changes to **items the user saved**. Never a discovery feed (see `00-document-audit` PR-3).
- **In** Home bell · notification tap. **Out** → the changed entity, opened at the changed section
- **Do** open · mark all read · manage watchlist (S-65)
- **Data** local watchlist diff records · **API** `GET /mobile/watchlist/changes?since=` ★
- **States** L: skeleton · E: "You'll see updates here when a saved project's figures change." + link to Saved · Err: retry · Off: shows locally stored diffs
- **Events** `updates_opened`, `update_item_opened{entity_type, change_type}`

### S-12 · Notification/update detail — *not a screen.* Notifications route directly to the entity, anchored to the changed section. Documented here so it is not built as a screen.

---

## C · Search

### S-13 · Search (`screen`, tab 3, idle state)
- **Purpose** The name-first entry to everything. Focused input on mount.
- Content when idle: recent searches · saved items · "Try searching for" examples per entity type (a village, a contractor, a scheme, a tender ID).
- **User** Journalist, RTI activist (primary). **In** tab bar · any "search" affordance · deep link. **Out** → S-14
- **Do** type · voice input · secondary: clear history, open a recent
- **Data** local search history · **API** `GET /search/suggest?q=` ★ (debounced 250ms, cancellable)
- **States** Off: history + saved items only; suggestions disabled with an inline note
- **Perms** microphone (optional, voice only) · **Events** `search_opened{entry_point}`

### S-14 · Search results (`screen`)
- **Purpose** Grouped, typed results — never one undifferentiated list.
- Groups in fixed order: Places · Projects · Contractors · Tenders · Schemes · Departments · Documents. Each group capped at 3 with "See all N".
- **In** S-13. **Out** → any entity screen · S-15 (see-all) · S-16 (filters)
- **Do** open result · secondary: filter (S-16), switch group, save search
- **Data** typed search hits with a short subtitle carrying the disambiguator (district for a village, FY + district for a project)
- **API** `GET /search?q=&types=&unitId=&fy=&cursor=` ★
- **States** L: grouped skeletons · E: **S-15 no-results** (below) · Err: "Search is unavailable" + retry, local history still usable · Off: local-only match over saved + recently viewed, clearly labeled "Searching your saved items only"
- **Events** `search_performed{result_count_bucket, types_returned, had_filters}` — **query text is never sent** (`.docs/16-observability.md`)

### S-15 · Search — no results (`screen` state)
- **Purpose** Explain *why* nothing matched and give a next action. Three distinct cases, three distinct messages:
  (a) *out of coverage* — "LokDarpan currently covers Maharashtra roads. <term> may be outside that." + link to coverage.
  (b) *spelling* — "Did you mean …" from the suggest endpoint.
  (c) *published but not ingested* — "No official record matching <term> has been ingested." + link to Source Registry + Report a data issue.
- **Events** `search_zero_results{reason}`

### S-16 · Search filters (`sheet`)
- **Purpose** Narrow by entity type, place, FY, category, status. Applies live with a result count.
- **Do** apply · reset · **Data** filter facets · **API** facets returned by `GET /search` ★
- **Events** `search_filtered{facets}`

### S-17 · Search history (`screen`)
- Manage/clear recent searches. Local only; never synced without an account. **Events** `search_history_cleared`

---

## D · Explore — map & hierarchy

### S-18 · Explore (`screen`, tab 2) — map/list toggle
- **Purpose** Geographic discovery. Two co-equal presentations of the same query: **Map** and **List**. The list is not a fallback — it is the accessibility- and low-end-device-equivalent surface (`.docs/12-accessibility.md`).
- **In** tab bar · Home map peek · any entity "view on map". **Out** → S-19 · S-20 · S-23 · S-27
- **Do** pan/zoom · toggle map⇄list · filter (S-21) · locate me · tap feature (S-19/S-20) · secondary: change layer, change metric
- **Data** MVT boundary + asset tiles, per-unit choropleth metric, viewport feature list
- **API** `GET /tiles/{layer}/{z}/{x}/{y}.mvt`, `GET /mobile/map/features?bbox=&z=&filters=` ★
- **States** L: basemap first, data layers fade in; skeleton list in list mode · E: "No mapped records in this view" + "Zoom out" · Err: basemap renders, data layer error banner, list mode still works · Off: cached tiles for previously visited areas + downloaded packs; un-cached areas render as an explicit grey hatch, **never blank**
- **Perms** location (optional) · **Events** `map_viewed{z, layer, metric}`, `map_layer_changed`, `map_list_toggled{to}`

### S-19 · Feature preview (`sheet`, peek)
- **Purpose** Fast identification without leaving the map. Name · type · place · headline finance · verification-priority chip · "Open".
- **In** tap a map feature. **Out** → S-23 / S-27 / S-40
- **API** included in S-18's feature payload (no extra round trip)
- **States** L: none (data already local) · Off: renders from tile properties, with a note that finance may be stale
- **Events** `map_feature_previewed{type}`, `map_project_opened`

### S-20 · Cluster contents (`sheet`)
- **Purpose** When a cluster is too dense to zoom into, list its members with the same preview rows.
- **In** tap a cluster at max useful zoom. **Out** → S-19 → entity
- **API** `GET /mobile/map/cluster?bbox=&z=&clusterId=` ★ (cursor-paged)
- **States** L: rows skeleton · E: impossible by construction · Off: members present in the cached tile only, count labeled "at least N"
- **Events** `map_cluster_opened{count_bucket}`

### S-21 · Map filters (`sheet`)
- Layer (boundaries / roads / projects / facilities) · metric for choropleth (utilization %, per-capita expenditure, project count, median cost/km) · category · status · FY · verification-priority band. Includes the **legend**, which states that colour encodes a measurement, not a judgment (`docs/15`).
- **Events** `map_filtered{facets}`

### S-22 · Hierarchy browser (`screen`)
- **Purpose** The researcher's path: India → State → Division → District → Taluka/Block → Local body → Village → Ward, one level per screen, pushed onto the stack.
- **In** Explore header "Browse" · S-09 · S-23 "children". **Out** → S-22 (next level) · S-23
- **Do** open child · secondary: sort children by name / expenditure / utilization, search within level
- **Data** `AdminUnit[]` with a headline metric each
- **API** `GET /units/:id/children?fy=&sort=` (extended ★ to carry a per-child metric so the list is meaningful, not just names)
- **States** L: rows skeleton · E: "No sub-units of <unit> are published in the Local Government Directory data we've ingested" · Err: retry · Off: cached level, "N of M sub-units cached"
- **Events** `hierarchy_level_opened{level, child_count_bucket}`

---

## E · The Unit screen (level-agnostic)

> **S-23 replaces six separate dashboards from `docs/09`** (National, State, District, Village/Local-Body, plus Infrastructure and Audit scoped views). One screen, one learned layout, at every level.

### S-23 · Unit detail (`screen`)
- **Purpose** Everything about one place: what money came in, what went out, what was built, and whether it reconciles.
- **Sections** (fixed order — the four-panel pattern from `docs/09` §Level-agnostic):
  1. **Header** — name, level, parent chain ("Up to Pune district"), population, FY chip, coverage chip.
  2. **Money in** — allocations + inter-governmental transfers, by scheme. Every figure source-linked.
  3. **Money out** — releases + expenditure; the Money Trail component (`.docs/06-design-system.md`).
  4. **What was built** — project/asset counts by domain and status; "View on map"; "See all projects".
  5. **Consistency** — vertical roll-up check (`docs/06` §10), peer comparison vs. siblings (`docs/06` §9), observation count. Framed as *worth verifying*.
  6. **Coverage** — what is missing and which source would carry it. Prominent at local-body level (`docs/09`).
- **User** All. **In** everywhere. **Out** → S-24 · S-25 · S-26 · S-27 list · S-18 · S-49 · S-52 · S-58
- **Do** open a section · secondary: save (S-62), share link, change FY, ask about this unit, view on map
- **Data** `AdminUnit`, `Finance` (own + rollup), `RollupCheck`, peer stats, counts, `Anomaly[]` summary, coverage
- **API** `GET /mobile/units/:id?fy=` ★ (composite: unit + finance + rollup + consistency + counts + top observations + coverage)
- **States** L: header from cache/route params instantly, then section skeletons · E: per-section — "No allocations published for <unit> in <FY>" with the source that would carry it · Err: per-section retry, never a whole-screen failure · Off: cached snapshot + offline bar + `asOf`
- **Events** `unit_viewed{level, fy, from}`, `unit_section_expanded{section}`

### S-24 · Unit children (`screen`) — full sorted list of sub-units with per-child metric. Feeds S-22.
### S-25 · Roll-up consistency detail (`screen`)
- **Purpose** Show the parent figure, the sum of children, the gap, the gap %, which children are missing from the sum, and the exact neutral observation. Explicitly states: *records may be incomplete* — never diversion.
- **API** `GET /units/:id/consistency?fy=` · **Events** `rollup_viewed{gap_pct_bucket}`
### S-26 · Peer comparison (`screen`)
- **Purpose** This unit vs. its siblings on a normalized metric (per-capita, utilization ratio, per-project). Distribution strip with this unit marked, `n`, median, and the minimum-sample guard from `docs/06` §4.
- **API** `GET /units/:id/peers?metric=&fy=` ★
- **States** E: "Fewer than 8 comparable units — comparison withheld" (the `low_sample` rule, surfaced honestly)
- **Events** `peer_comparison_viewed{metric, n_bucket}`

---

## F · Project

### S-27 · Project detail (`screen`)
- **Purpose** The core "follow the money" screen — one project, end to end.
- **Sections** header (name, category, status, place, department, scheme, work ID) · **Money Trail** (Allocated → Released → Utilized → Remaining, vertical) · **Verification Priority** chip → S-36 · **Timeline** peek → S-31 · **Contractor & tender** → S-40/S-42 · **Road/asset intelligence** → S-33 · **Observations** (n) → S-34 · **Location** → S-39 · **Sources** (n) → S-52 · **Coverage**.
- **User** All. **In** search, map, unit, saved, deep link, updates. **Out** → S-28 … S-39, S-52, S-58, S-62
- **Do** open Money Trail · secondary: save, share, ask, compare (S-37), report a data issue (S-78)
- **Data** `Project`, `ProjectFinance`, `RiskScore`, `Anomaly[]`, `Tender`, `Contractor`, `Road`/`Facility`, `ProjectProgress[]`, `Provenance[]`
- **API** `GET /mobile/projects/:id` ★ (composite; replaces 5–7 round trips)
- **States** L: header from route params + skeletons · E: per-section, naming the missing record type · Err: per-section retry · Off: cached; if saved, guaranteed complete offline (see `.docs/11-offline-strategy.md`)
- **Events** `project_viewed{category, from, has_full_chain}`

### S-28 · Money Trail (`screen`)
- **Purpose** The financial chain in full: each stage with its total, its constituent ledger lines, its source, and the derived variance between stages.
- Renders **release variance** and **allocation variance** as separately labeled quantities with their formulas visible (`00-document-audit` C1/A4). `insufficient_data` is a distinct state, never ₹0.
- **In** S-27. **Out** → S-29 · S-52
- **API** `GET /mobile/projects/:id/finance` ★
- **States** E: per-stage — "No release records published for FY2024-25" · Off: cached
- **Events** `money_trail_viewed`, `variance_explained_opened{which}`

### S-29 · Ledger lines (`screen`) — allocations / releases / expenditures as a list; each row = amount, date, installment/head, source chip. **Out** → S-30, S-52.
### S-30 · Ledger line detail (`sheet`) — one row's full record: amount, all metadata, versions (S-30a), and the source. **Out** → S-52, S-55.
### S-30a · Value history (`screen`) — every retained `record_version` for this line (budget revisions), with the source and date of each. Implements `docs/15` rule 9 (preserve historical versions) on mobile.
### S-31 · Timeline (`screen`) — sanction → tender → releases → expenditures → progress snapshots → completion, vertical, each node source-linked. **Events** `timeline_viewed`
### S-32 · Progress history (`screen`) — physical % and financial % over time with the reporting dates; explicit gaps between snapshots shown as gaps, not interpolated.
### S-33 · Road / asset intelligence (`screen`)
- Cost per km (actual) vs. modeled expected vs. district median, with `n`, the model version, the coefficient table, and the **mandatory caveat block** from `docs/08` (*"Modeled estimates are engineering approximations with stated assumptions; deviations can be legitimate."*).
- **API** part of `GET /mobile/projects/:id` ★ · **States** E: "Length or width not published — estimate withheld" (never guessed)
- **Events** `road_intelligence_viewed{has_model}`
### S-34 · Observations (`screen`) — the neutral anomaly list for this project. Each row: observation text (server-provided), severity, confidence, evidence count.
### S-35 · Observation detail (`screen`) — the observation, the arithmetic that produced it, every input figure with its source, the threshold, and the disclaimer. **Out** → S-52, S-58 ("Explain this").
### S-36 · Verification Priority breakdown (`screen`)
- The 0–100 score, its band, its **confidence**, and all six factors from `docs/07` with weight, sub-score, contribution, and a neutral per-factor note. Standing disclaimer. Never rendered without the breakdown reachable in one tap.
- **Events** `verification_priority_opened{band}`
### S-37 · Comparison picker (`screen`) — choose 1–3 comparable projects (suggested peers from the same category/district/scale bucket, or search).
### S-38 · Comparison result (`screen`) — mobile comparison **cards**, one project per card, vertically stacked and horizontally swipeable, with a shared metric rail. **Never a wide table.** **API** `GET /mobile/compare?ids=` ★ **Events** `comparison_created{n, metric}`
### S-39 · Project location (`screen`) — map focused on this project's geometry, with the same layers as S-18. Reuses the map surface, does not duplicate it.

---

## G · Procurement

### S-40 · Tender detail (`screen`) — external tender ID, title, estimated vs. awarded amount, bidder count, dates, status, awarded contractor, linked project. Every figure source-linked. No characterization of any party.
### S-41 · Tenders list (`screen`) — scoped to a unit, project, department, or contractor; cursor-paged.
### S-42 · Contractor detail (`screen`)
- **Descriptive statistics only** (`docs/10`): canonical name, class/grade, **aliases** (transparency of canonicalization), tender count, total awarded, average bidders, scope share. A standing note explains that names were canonicalized from listed variants and that share is a market-structure statistic.
- **Explicitly absent:** any score, rank, badge, flag, or "risk" attached to the contractor (`docs/07` — never rank people).
- **Events** `contractor_viewed`
### S-43 · Contractor tenders (`screen`) — that contractor's award records, cursor-paged, each source-linked.
### S-44 · Concentration context (`screen`) — HHI and top-k share for a scope, with the standard descriptive labels from `docs/06` §8 and an explanation of what HHI is. Attached to a **scope**, never to a contractor.

---

## H · Scheme & department

### S-45 · Scheme detail (`screen`) — scheme, ministry, type, domain; allocations/releases across units; project list; coverage.
### S-46 · Schemes list (`screen`) — scoped to a unit or ministry.
### S-47 · Department / ministry detail (`screen`) — the same four-panel pattern as S-23, applied to an organizational rather than geographic unit.
### S-48 · Departments list (`screen`).

---

## I · Consistency

### S-49 · Observations, scoped (`screen`)
- **Purpose** "Worth verifying in <unit>" — the audit worklist, always **entered from a unit or project**, never a global feed and never a tab (`00-document-audit` PR-3).
- Standing disclaimer at the top, not collapsible: *"These are data-consistency observations from official records, not findings of wrongdoing."*
- **API** `GET /mobile/observations?unitId=&fy=&type=&severity=&cursor=` ★
- **States** E: "No consistency observations for <unit> in <FY>." — and, importantly, a note that this may mean records are complete **or** that records are missing; links to coverage.
- **Events** `observations_viewed{scope_level, count_bucket}`, `anomaly_viewed{type}`
### S-50 · Observation filters (`sheet`) — type, severity, confidence floor, FY.
### S-51 · Coverage report (`screen`)
- **Purpose** Missing-record and low-confidence items, kept **separate from deviations** (`docs/09` — these are coverage issues, not inconsistencies). Lists what was expected, what is present, what is absent, and the source that would carry it.
- **API** `GET /mobile/units/:id/coverage?fy=` ★ · **Events** `coverage_viewed{missing_pct_bucket}`

---

## J · Sources & traceability

### S-52 · Source sheet (`sheet`) — **the most important surface in the product**
- **Purpose** Reachable from *every single figure in the app* in one tap. Shows: the value, the issuing authority, the document title, the page/table locator, the extraction method, the extraction confidence, retrieved-at and published-at, and the actions **View document** / **Open original** / **View lineage**.
- **In** any `<Figure>` component anywhere. **Out** → S-53 · S-54 · S-55
- **API** provenance is embedded in every payload; `GET /sources/:docId` for the full record
- **States** L: from embedded provenance, instant · E: **impossible by design** — a figure with no provenance cannot be rendered (`.docs/06-design-system.md` §Figure) · Off: full metadata cached with the figure; document body may be unavailable, stated plainly
- **Events** `source_opened{from_screen, extraction_method}`
### S-53 · Source document detail (`screen`) — the document as a record: authority, title, type, license, artifact hash, retrieval, publication, all figures extracted from it.
### S-54 · Document viewer (`modal`)
- **Purpose** Read the official document, **opened at the page the figure came from**, with the extracted value overlaid and highlighted where a bounding box exists.
- Order of presentation: the **extracted-value card first** (what we read, at what confidence), then the page. A user must never be dropped into page 42 of a scanned Marathi PDF with no orientation.
- **In** S-52, S-53. **Out** dismiss
- **Do** page navigation, jump-to-locator, zoom, share original URL, download for offline
- **API** `GET /sources/:docId/artifact` with HTTP `Range` ★ (M5)
- **States** L: page-by-page progressive with byte-progress · E: "The original document is no longer reachable at its published URL" + last-known-good archived copy + retrieval date · Err: "Open in browser" fallback · Off: available only if downloaded; the button states the size before download
- **Perms** none (no filesystem access needed; sandboxed viewer) · **Events** `document_opened{doc_type, page_anchored}`, `document_downloaded{bytes_bucket}`
- **Security** host allow-list from the source registry, no script execution, size cap — see `.docs/13-mobile-security.md`
### S-55 · Lineage (`screen`) — the provenance chain for a figure: source document → extraction method + confidence → normalization applied → record version → any derived calculation that used it. Implements `.docs/10-source-traceability.md`.
### S-56 · Source registry (`screen`) — browse the approved official sources from `docs/18`, with per-source status: last successful fetch, link health, records ingested, license. Makes the platform's own data supply auditable by the public.
### S-57 · Methodology explainer (`sheet`) — per-metric: what this number is, the exact formula from `docs/06`/`07`/`08`, its assumptions, and its limits. Attached to every derived figure via a "?" affordance.

---

## K · Ask (AI)

### S-58 · Ask (`screen`, always scope-bound)
- **Purpose** A guardrailed explainer over the ingested ledger. **Never a free-floating chatbot; never a tab** (`00-document-audit` A2).
- Header always displays the immutable scope ("Pune district · rural roads · FY2024-25"), which the user changes deliberately.
- **In** Home "Ask about <scope>" · any entity "Explain this" · S-35 · S-49. **Out** → S-59 · cited entities
- **Do** ask (typed or from suggestions) · secondary: change scope, copy, share, view citations
- **Data** scope, question, answer, citations, guardrail note, `datasetVersion`
- **API** `POST /ai/ask` (streamed ★, quota'd ★)
- **States** L: **streamed tokens**, with the retrieval step named ("Reading 41 official records for Pune…") · E: *"No ingested official records cover this."* — the mandated refusal from `docs/11`, not an apology · Err: falls back to the deterministic template summary from `docs/11` §Templated fallback · Off: **Ask is disabled offline**, stated plainly, with cached previous answers readable
- **Perms** none · **Events** `ai_question_asked{scope_level, from_suggestion}`, `ai_answer_shown{citation_count, was_template, was_refusal}`
- **Constraint** every factual sentence carries a tappable citation; an answer with zero citations is never displayed.
### S-59 · Answer citations (`screen`) — every cited figure, its source, and a link to the entity and the document page.
### S-60 · Ask history (`screen`) — local-only, never synced without an account, clearable. Questions are **never** sent to analytics.
### S-61 · Suggested questions (`overlay` within S-58) — scope-derived, template-backed starters; guarantees the first-run experience produces a good answer.

---

## L · Saved & offline

### S-62 · Saved (`screen`, tab 4) — projects, places, contractors, tenders, and saved searches, grouped by type, with each item's cached freshness and offline availability.
- **API** local-first; `GET /mobile/watchlist/changes?since=` ★ for freshness
- **States** E: a genuine empty state that teaches — "Save a project to keep its figures, sources and updates, even offline." · Off: fully functional
- **Events** `project_saved{type}`, `saved_opened`
### S-63 · Collection detail (`screen`) — a user-named group of saved items (e.g. an RTI file, a story). Local.
### S-64 · Offline packs (`screen`)
- **Purpose** Manage explicit downloads: per-district packs (unit tree + project index + map tiles for the bbox), per-item bundles, and downloaded documents. Shows size **before** download, current usage, and Wi-Fi-only toggle.
- **API** `GET /mobile/packs/:unitId/manifest?since=` ★
- **States** L: per-pack progress, resumable · Err: partial pack is usable, states what is missing · Off: manage/delete works; download queued
- **Events** `offline_pack_downloaded{unit_level, bytes_bucket}`, `offline_pack_deleted`
### S-65 · Watch settings (`sheet`) — per saved item: which changes to be told about (new expenditure, new release, status change, new observation, source superseded). Default: figures only. See `.docs/22-notifications.md`.

---

## M · Profile, settings, legal

### S-66 · Profile (`screen`) — optional. Anonymous by default; shows what is stored on device and what would sync if an account existed.
### S-67 · Sign in (`modal`) — **optional, deferred, and only for cross-device sync.** Email link or passkey; no social login (no third-party identity in a civic tool). See `adr/008-authentication.md`.
### S-68 · Settings (`screen`) — language, appearance (system/light/dark), text size note, data & storage (S-70), notifications (S-71), accessibility (S-72), privacy & analytics toggle, about (S-73), legal (S-74/75), methodology (S-76), sources (S-56), report an issue (S-78), feedback (S-79), licenses (S-80), replay introduction (S-02).
### S-69 · Language settings (`screen`) — English / मराठी / हिन्दी, plus number-format preference (Indian crore-lakh grouping vs. international).
### S-70 · Data & storage (`screen`) — cache size, offline packs, downloaded documents, "download over Wi-Fi only", clear cache (with a clear statement of what is lost), clear search/ask history.
### S-71 · Notification settings (`screen`) — master toggle, per-change-type defaults, quiet hours. Off by default until a first save.
### S-72 · Accessibility settings (`screen`) — reduce motion, increase contrast, always show data tables instead of charts, prefer list over map, larger touch targets.
### S-73 · About (`screen`) — what LokDarpan is, **and the non-affiliation statement**: not a government product, not affiliated with any government body or political party. Version, build, dataset version.
### S-74 · Legal & neutrality (`screen`) — the positioning statement and the mandatory rules from `docs/15`, verbatim and non-collapsible.
### S-75 · Privacy (`screen`) — what is collected (little), what is not (location, queries, questions, identity), what is on-device only.
### S-76 · Data methodology (`screen`) — how figures are collected, extracted, normalized, versioned, and computed; links to per-metric explainers (S-57).
### S-77 · Coverage & limitations (`screen`) — what is and is not covered today, per `docs/01` §Limitations. Reachable from every empty state.
### S-78 · Report a data issue (`screen`) — the `docs/15` right-of-reply channel: entity, figure, what's wrong, optional contact. Works offline (queued).
- **Data** RHF + Zod form · **API** `POST /feedback/data-issue` ★ · **Events** `data_issue_reported{entity_type}`
### S-79 · Feedback (`screen`) — product feedback, distinct from a data correction.
### S-80 · Open-source licenses (`screen`) — generated, not hand-written.

---

## N · Cross-cutting states (specified once, applied everywhere)

Not screens. Full behaviour in `.docs/15-state-design.md`; listed here so no screen is built without them.

`Loading` (skeleton-first, spinner only >2s) · `Empty — no data published` · `Empty — outside coverage` · `Empty — filtered out` · `Error — network` · `Error — server` · `Error — not found` · `Error — rate limited (429)` · `Offline — cached` · `Offline — not cached` · `Partial data` · `Stale data` · `Low-confidence figure` · `Superseded record` · `Permission denied — location` · `Permission denied — notifications` · `Upgrade required` · `Source unavailable`.

---

## Screens that must **not** exist

Each of these is a desktop or engagement pattern that would either misrepresent the data or violate `docs/15`. They are listed so that "we forgot it" is never confused with "we decided against it."

| Not built | Why | Instead |
|---|---|---|
| **KPI-tile dashboard Home** | A grid of big numbers with no source affordance is the opposite of this product. | S-10, an intent launcher |
| **Six separate level dashboards** (`docs/09`) | Six layouts to learn; identical information architecture. | S-23, one level-agnostic Unit screen |
| **Wide data tables** | Unreadable and unscrollable at 390pt; encourages horizontal scroll. | S-38 comparison cards; S-29 ledger lists |
| **Global "Anomalies" tab / feed** | Turns neutral observations into an engagement stream; the single largest neutrality risk on mobile. | S-49, always scoped to a unit the user chose |
| **"Worst districts / worst contractors" ranking** | `docs/07` explicitly forbids ranking people or presenting risk as a leaderboard. | S-26 peer distribution (no rank), S-44 scope-level concentration |
| **Standalone "Analytics" tab** | Analytics without an entity is a chart looking for a question. | In-context on S-23/S-27 |
| **Free-floating AI chat tab** | Makes the product a chatbot; invites out-of-scope questions the guardrails must then refuse. | S-58, always scope-bound |
| **Persistent breadcrumb bar** | Consumes 44pt of vertical space permanently for information the stack already encodes. | Scope chip + "Up to <parent>" + long-press back |
| **Sidebar / drawer navigation** | Desktop pattern; hides everything behind a hamburger. | 4 bottom tabs |
| **In-app bulk export / API-key management** | Researcher workflow; belongs to the API. | Share-sheet CSV of one view |
| **Admin / quarantine / entity-review console** | Internal, SSO+MFA, desktop. | Out of mobile scope entirely |
| **Chart-to-PNG export** | Exports a number without its source, breaking `docs/15` rule 5. | Share a universal link (which carries the source) |
| **Onboarding that can be fully skipped** | The neutrality frame is not optional. | Skip permitted, but Panel 2 always shown |
| **Social login** | Injects a third-party identity provider into a civic transparency tool used by activists. | Email link / passkey only, and only for sync |
| **Gamification, streaks, badges** | Trivialises public finance. | — |

---

## Counts

80 numbered surfaces: 47 `screen`, 14 `sheet`, 3 `modal`, plus 18 cross-cutting states applied across all of them. 14 patterns explicitly rejected.
