## What and why

<!-- What changes, and which document or decision it implements. -->

> Base branch is **`development`**, not `main` ([`adr/032`](../.docs/adr/032-development-is-reinstated.md)).
> A PR targeting `main` that is not a release PR is the signal that flow has failed.

## Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm neutrality` passes (the docs/15 language gate, over `apps packages services`)
- [ ] A changeset, if this changes what the pipeline extracts, stores or publishes — `pnpm changeset` ([`adr/028`](../.docs/adr/028-changesets-for-the-record-not-the-release.md))
- [ ] Every new figure renders through `<Figure>` with its `provenance`
- [ ] No variance computed across a missing stage; nothing renders `₹0` for missing data
- [ ] No red in any variance / severity / verification-priority / status style
- [ ] No score, rank, badge or flag attached to a contractor
- [ ] No person, official, contractor or firm named outside a neutral descriptive statistic ([`adr/033`](../.docs/adr/033-a-name-is-not-a-statistic.md))
- [ ] Documentation updated in `.docs/`, or an ADR added, **in this PR**

## Documentation

<!-- Which .docs/ file(s) this implements or changes. A decision that lives only
     in a commit message will be silently reversed within two quarters. -->
