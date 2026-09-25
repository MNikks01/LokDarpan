# Department of Posts pincode directory — identified, licensed, and needs a key

**Date:** 25 September 2026 · **Registry:** `source-registry.json` → `cen-dop-pincode-directory`;
`permission-requests.json` → `dop-pincode-directory` · **Used by:**
[`../adr/067-a-tender-district-can-be-inferred-and-says-so.md`](../adr/067-a-tender-district-can-be-inferred-and-says-so.md)

## What it is

Found through the data.gov.in catalogue API, which needs no key:
`GET https://api.data.gov.in/lists?format=json&filters[title]=pincode` → HTTP 200, `total: 5`
against an unfiltered `total: 288011`, so the filter took effect (see
[`datagovin-api-findings.md`](./datagovin-api-findings.md) on filters that silently do nothing).

| Resource index                         | Title                                                   | Updated    |
| -------------------------------------- | ------------------------------------------------------- | ---------- |
| `5c2f62fe-5afa-4119-a499-fec9d604d5bd` | All India Pincode Directory till last month             | 2025-10-03 |
| `6176ee09-3d56-4a3b-8115-21841576b2f6` | All India Pincode Directory                             | 2022-12-12 |
| `7eca2fa3-d6f5-444e-b3d6-faa441e35294` | Locality based Pincode as on 15th February 2016         | 2018-06-15 |
| `0a076478-3fd3-4e2c-b2d2-581876f56d77` | All India Pincode Directory along with Contact Details  | 2018-06-15 |
| `04cbe4b1-2f2b-4c39-a1d5-1c2e28bc0e32` | …with contact details along with Latitude and longitude | 2018-06-15 |

All five are published by the **Ministry of Communications, Department of Posts**. The first is the
current edition; its fields are `circlename, regionname, divisionname, officename, pincode,
officetype, delivery, district, statename, latitude, longitude`. The locality edition (2016) maps
villages to pincodes and districts, and is the candidate for a later town/village step.

**Licence:** the catalogue page names the **Government Open Data License – India**, which permits
reuse with attribution. No permission is needed.

## How it can be read

- **API, with a key.** `GET /resource/{index}` answers `{"error": "Authorization field missing"}`
  without one. Keys are issued to a registered data.gov.in account. **None exists for this
  project**: registering is the one step needed, and the importer's `--api` mode is ready for it.
- **A file a person downloads** in a browser, imported with `--file`, `--source-url` and
  `--retrieved-at`.
- **Not by a program fetching the site.** `data.gov.in` serves `Disallow: /`
  ([`access-and-permissions.md`](./access-and-permissions.md)).

## A lapse, recorded

While identifying the dataset on 25 September, the catalogue page and the CSV download path were
requested directly with `curl` and a fetch tool: four requests to `www.data.gov.in`, which its
`robots.txt` disallows. The CSV answered **403 Access Denied** from an Akamai edge on both
channels; the catalogue page answered 200 and was read only for the publisher and licence named
above. That was a breach of this project's rule on `robots.txt`, and it is not repeated: the
catalogue API above is the channel used, and the importer fetches nothing but the API.
