# Maharashtra local-body boundaries — OpenStreetMap holds few of them

**Date:** 2026-09-05 · **Source:** OpenStreetMap via Overpass, ODbL 1.0 · **Related:** [`adr/022`](../../adr/022-web-map-explorer.md), [`adr/047`](../../adr/047-a-shared-service-is-asked-when-it-is-free.md)

## What was ingested

Every district of Maharashtra was queried for `admin_level` 6 and 8, one query
per district.

| Level                 | Held | Carrying an LGD code | With a boundary |
| --------------------- | ---- | -------------------- | --------------- |
| District              | 36   | 36                   | 36              |
| Sub-district (taluka) | 355  | 353                  | 355             |
| Urban local body      | 18   | **0**                | 18              |

## The finding

**Taluka coverage is effectively complete and well identified.** 353 of 355
carry a `ref:LGD:subdistrict` tag, so they are the same records the Local
Government Directory names, not a parallel set of places.

**Local-body coverage is not.** Maharashtra has on the order of 270 urban local
bodies — around 28 municipal corporations and some 240 municipal councils and
nagar panchayats. OpenStreetMap tags **18** of them at `admin_level` 8, and
**none carries an LGD code**. The 18 are concentrated in the Mumbai
metropolitan region, with Nagpur and Gondia districts contributing the rest.
Corporations as large as Mumbai, Pune, Nashik and Chhatrapati Sambhajinagar are
absent.

Recorded per the registry rule as: **boundaries for Maharashtra's remaining
urban local bodies were not identified in OpenStreetMap as of 2026-09-05.** Not
as "they do not exist".

## Why the authoritative register does not fill the gap

The Local Government Directory is the authoritative list of which local bodies
exist, and it publishes no boundaries. Its bulk download — which offers exactly
the hierarchy wanted — is CAPTCHA-gated, as is its district view
([`lgd-access-findings.md`](../lgd-access-findings.md)). So the register that
knows the names cannot currently be collected either, and the map that has the
shapes does not know the codes.

## What this means for a reader

A district with no local body listed means **none is held**, never that the
district has no municipal government. Pune district is the clearest case: 14
talukas are held and no local body, while Pune Municipal Corporation plainly
exists.

The explorer must therefore distinguish "no local body is held for this
district" from "this district has none" — the same distinction the tender
surface already draws between a collection gap and an absence of advertisements.
That statement is **not yet implemented**; it is the next piece of work on this
surface.

## Identity

Until an LGD code can be attached, a Maharashtra local body's only stable
identifier is its OSM relation id. That is sufficient for the ledger's
`admin_unit_identified` rule and insufficient for resolving a local body named
in another source, which is what an LGD code would make possible.
