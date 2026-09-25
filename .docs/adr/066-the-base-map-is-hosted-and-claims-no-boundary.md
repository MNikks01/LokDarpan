# ADR-066 · The base map is hosted, and claims no boundary

**Status:** Accepted · **Date:** 2026-09-25 · **Supersedes** the web basemap policy of
[`006-maps.md`](006-maps.md) §Basemap (self-hosted PMTiles). ADR-006 stands for the deferred mobile
app.

## Context

The explorer's base map was an OpenStreetMap extract served as PMTiles from the deployment itself.
Only a Nagpur extract was ever built, so production showed no base map at all: an all-India archive
is several gigabytes to build, host and refresh, which is work this stage does not justify.

The decision taken on 2026-09-25 was not to self-host tiles yet, to use a reputable tile provider
with MapLibre, and to keep official administrative boundaries separate from the visual base map.

## Decision

**Hosted, configurable, and OpenFreeMap by default.** `NEXT_PUBLIC_BASEMAP_STYLE_URL` names any
MapLibre style in the OpenMapTiles schema; unset, it is OpenFreeMap's `positron`
(`https://tiles.openfreemap.org/styles/positron`, fetched and checked on 2026-09-25). OpenFreeMap
needs no account and no key, so the change needs nothing from anyone to work. Set to an empty value,
there is no base map at all.

**The base map draws no administrative boundary and names no country or state.** A hosted style
draws the lines its data holds, and for India those are OpenStreetMap's, not the Survey of India's.
`withoutAdministrativeClaims` removes every `boundary` layer, disputed or not, and narrows every
`place` layer's filter to exclude the `continent`, `country`, `state` and `province` classes. It
narrows filters rather than deleting layers by id, so a provider renaming a layer cannot bring a
country label back. The only boundaries on the map are the ledger's, each with its source named in
the Boundary sources panel. LGD remains authoritative for the hierarchy.

**A provider that does not answer is not an error.** The ledger's boundaries draw on a flat
background and the map says no base map is shown.

## Consequences

- **Readers' browsers now request tiles from a third party.** The reader's IP address and the area
  viewed reach the provider. This is the privacy cost ADR-006 declined; it is accepted here for this
  stage, and a deployment can remove it by setting the style URL empty or pointing it at a
  self-hosted style later.
- **OpenFreeMap offers no service level.** Its terms (as read on 2026-09-25) provide the service
  "as-is" with no warranty of availability. A commercial provider serving an OpenMapTiles-schema
  style (MapTiler, for one) is a configuration change, but needs an account and a key that do not
  exist today.
- **Attribution is shown on the map**: the provider's stated credit where the style has one, else
  "OpenFreeMap · © OpenMapTiles · © OpenStreetMap contributors (ODbL)" for the default, else the
  host's name. `NEXT_PUBLIC_BASEMAP_ATTRIBUTION` overrides the fallback for another provider.
- `pmtiles`, `@protomaps/basemaps` and the extract script are removed.
- **Not changed by this ADR:** the ledger's own state and district geometry still comes from
  OpenStreetMap relations matched to LGD codes, labelled "Open dataset — usable, not
  authoritative". Replacing it with Survey of India geometry is separate work and depends on finding
  a source whose terms permit it.
