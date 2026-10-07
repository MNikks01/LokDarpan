# ADR-073 · A restricted source opens on a recorded grant and a switch

**Status:** Accepted · **Date:** 2026-10-07 · **Implements** [`../decisions/2026-10-07-permissions-deferred.md`](../decisions/2026-10-07-permissions-deferred.md) · **Builds on** ADR-055, ADR-056

## Context

Two mechanisms decided what a reader may see, and nothing connected them:

- **The licence registry** (`packages/domain/src/source-licence.ts`) records each publisher's
  terms — `permitted`, `permission_required` or `unknown` — and `mayRepublish` refuses everything
  not `permitted`. The document, overview and geography repositories use it.
- **Two environment flags** (`apps/web/src/server/publishable.ts`): `PUBLISH_BEAMS_FIGURES` and
  `PUBLISH_TENDER_DETAILS`. Setting either to `true` published that source, whatever the registry
  said.

So the rule "never set them in production without a recorded permission" (`CLAUDE.md`) was prose.
A flag set by mistake, or set in anticipation of a permission, would have published a source whose
terms forbid it. And there was nowhere to record a permission once it arrived: making a source
publishable would have meant editing its licence entry, which would then misstate the publisher's
terms. GePNIC portals add a further shape the model could not express: permission is per issuing
department, not per portal.

On 7 October the maintainer deferred every permission request and asked that restricted sources be
enableable later **without architectural changes**.

## Decision

**Publication is one decision, `publicationDecision(sourceId, context)`, over three recorded facts:**

1. **The publisher's terms** (`LICENCES`), unchanged. `permitted` publishes; `unknown` or no entry
   withholds (`terms_unrecorded`), and nothing below can override that.
2. **A recorded grant** (`PERMISSION_GRANTS`), required for a `permission_required` source. A grant
   names its source, optionally the one issuer it is limited to, the request it answers, its date,
   its reference and any conditions. No grant: `permission_not_granted`.
3. **An operator's switch**, read from the environment by the server (the domain package does no
   I/O): `PUBLISH_RESTRICTED_SOURCES` (a comma-separated list of registry ids), or the two existing
   per-source flags. No switch: `not_switched_on`.

A decision carries its basis (`terms_permit`, `grant_recorded`) or its reason, so a surface can say
why something is withheld.

**A switch without a grant opens nothing.** That is the behaviour change: `PUBLISH_BEAMS_FIGURES=true`
alone no longer publishes BEAMS.

**The grant registry and `permission-requests.json` are held together by a test.** Every grant must
match a request whose status is `granted`, with the same reference and date, and every `granted`
request must have a grant. Today there are no grants.

`mayRepublish(sourceId)` keeps its signature and, with no grants recorded, its results; every
existing caller is unchanged.

## Alternatives considered

- **Keep the flags as the only gate.** Simplest, and the problem itself: correctness depends on
  whoever sets the environment.
- **Edit the licence entry to `permitted` when a grant arrives.** No new concept, but the registry
  would then state terms the publisher never published, and a withdrawn permission would have
  nowhere to be recorded.
- **Grants in the database.** Lets an operator record one without a deployment, but a grant is a
  legal fact reviewed in a pull request alongside its evidence, and it is rare. Code plus a test
  against the JSON keeps it reviewable. Revisit if grants become per-issuer and numerous.

## Consequences

- **Enabling a restricted source is data, not code:** add the grant (with its evidence in
  `permission-requests.json`) and set the switch. No route, repository or component changes.
- **A permission can be withdrawn** by removing the switch at once, and the grant in a follow-up.
- **Per-issuer grants are modelled but not yet applied per row.** `tenderDetailsArePublishable()`
  answers for all tenders, so only a source-wide grant opens it; a surface that lists one issuer's
  tenders calls `decideFor("gepnic", { issuer })`. Applying it per row in `/api/v1/tenders` is
  deferred until a per-issuer grant exists.
- Features for restricted sources are built and tested now, against fixtures and the local ledger,
  and render their withheld state in production (decision of 7 October).
