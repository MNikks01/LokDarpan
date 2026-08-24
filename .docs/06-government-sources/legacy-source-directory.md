# 18 — Government Data Source Registry (Central · All States · UTs)

> **Goal:** the official portals from which LokDarpan collects budgets, expenditure, tenders, infrastructure projects, finance records, roads/transport data, and statistical datasets.
>
> **Sourcing rule ([15](../17-legal/legal-ethical-rules.md)):** only official government portals. No news, blogs, social media, or third-party sites are ever used as sources of fact.

## How to read this registry

Each entry lists the issuing authority, what it provides, and its portal. Reliability of the **URL** varies:

- ✅ **Stable** — canonical top-level government domain (state/UT master portal, major central portal). Low churn.
- 🔎 **Verify** — department/treasury/e-tender subdomains change over time and differ by state. The URL shown is the expected/known location; **confirm it live before wiring a connector**, and record the confirmed URL + license in `sources/*.yaml` ([17](../02-architecture/deliverables-and-risk.md)).

This is a discovery directory, not a guarantee of live endpoints. The ingestion layer treats every URL as unverified until a connector run confirms it ([03](../04-data-engineering/data-collection-architecture.md)).

---

# India — Central Government

### 1. Open Government Data Platform (data.gov.in) — **most important** ✅

Central + state datasets, APIs, CSV/JSON exports, budget data.
`https://data.gov.in`

### 2. India Budget Portal ✅

Union Budget, ministry budgets, allocations, expenditure, receipts, demand-for-grants.
`https://www.indiabudget.gov.in`

### 3. Ministry of Finance ✅

Revenue, tax collection, fiscal deficit, budget releases.
`https://finmin.gov.in`

### 4. Department of Expenditure 🔎

Government spending, expenditure statements, budget releases, utilization.
`https://doe.gov.in`

### 5. Controller General of Accounts (CGA) ✅

Government accounts, monthly accounts of the Union, receipts, fiscal deficit. Public Financial Management System (PFMS) links.
`https://cga.nic.in` · PFMS: `https://pfms.nic.in`

### 6. Comptroller and Auditor General (CAG) ✅

Audit reports, financial/performance audits, department audits, public-expenditure reviews.
`https://cag.gov.in`

### 7. National Data Analytics Platform (NDAP, NITI Aayog) ✅

Cross-ministry datasets, public analytics, infrastructure & economic indicators.
`https://ndap.niti.gov.in`

### 8. NITI Aayog ✅

Government analytics, state rankings, development indicators.
`https://www.niti.gov.in`

### 9. Ministry of Road Transport and Highways (MoRTH) ✅

National highways, road projects, road budgets, infrastructure spending, road statistics.
`https://morth.nic.in`

### 10. National Highways Authority of India (NHAI) 🔎

NH project awards, progress, HAM/EPC/BOT contracts.
`https://nhai.gov.in`

### 11. PM Gati Shakti / National Master Plan ✅

Infrastructure planning across highways, railways, ports, logistics.
`https://pmgatishakti.gov.in` (also referenced as `gatishakti.gov.in`)

### 12. Government e-Marketplace (GeM) ✅

Procurement, vendor details, government purchases.
`https://gem.gov.in`

### 13. Central Public Procurement Portal (CPPP) ✅

Tenders, contracts, award values across central ministries; NIC eProcurement.
`https://eprocure.gov.in` · unified: `https://etenders.gov.in`

### 14. National Portal of India ✅

Directory of ministries, schemes, department links.
`https://www.india.gov.in`

### 15. Reserve Bank of India — Database on Indian Economy (DBIE) ✅

State finances, market borrowings (SDLs), fiscal indicators.
`https://rbi.org.in` · DBIE: `https://dbie.rbi.org.in`

### 16. Ministry of Statistics & Programme Implementation (MoSPI) ✅

National accounts, infrastructure & economic statistics, MPLADS/project monitoring.
`https://mospi.gov.in`

### 17. Ministry of Rural Development — roads & works ✅

PMGSY rural roads (see OMMAS), MGNREGA works & expenditure.
`https://rural.nic.in` · PMGSY/OMMAS: `https://omms.nic.in` · MGNREGA: `https://nrega.nic.in`

### 18. Ministry of Housing & Urban Affairs 🔎

Urban roads, Smart Cities, AMRUT, urban infrastructure.
`https://mohua.gov.in` · Smart Cities: `https://smartcities.gov.in`

---

# States

> Per-state block lists: **State portal** (✅ master domain), **Finance/Treasury/IFMIS**, **PWD / Roads**, **e-Procurement / Tenders**, **Economics & Statistics (DES)**, and the **data.gov.in state page** (✅ pattern `https://www.data.gov.in/state_utes/<State>`). Department subdomains are 🔎 — verify live.

## Maharashtra (Phase 1 focus)

- **State portal** ✅ — GRs, department links, circulars: `https://maharashtra.gov.in`
- **State Data Bank (gold mine)** 🔎 — district/economic/finance/infrastructure statistics: `https://mahasdb.maharashtra.gov.in` (raw data: `/rawData.do`, `/rawDataByCatalog.do`)
- **Finance Department / Mahakosh** 🔎 — budget, estimates, treasury, expenditure, receipts: `https://mahakosh.maharashtra.gov.in`
- **Public Works Department (PWD)** 🔎 — roads, bridges, highways, budgets, contractors, progress: `https://pwd.maharashtra.gov.in`
- **e-Tender portal (Mahatenders)** 🔎 — tender notices, bid/award values, contractors: `https://mahatenders.gov.in`
- **Transport Department** 🔎 — road transport projects, vehicle/RTO statistics: `https://transport.maharashtra.gov.in`
- **Economic Survey / DES (Directorate of Economics & Statistics)** 🔎 — GSDP, revenue, district reports: `https://mahades.maharashtra.gov.in`
- **MRSAC (Remote Sensing Application Centre)** 🔎 — GIS, satellite, geo-tagged assets, roads: `https://mrsac.gov.in`
- **MARS (Maharashtra Asset Register System)** 🔎 — geo-tagged public-infrastructure registry, unique asset IDs
- **Aaple Sarkar** 🔎 — government services/records: `https://aaplesarkar.mahaonline.gov.in`
- **data.gov.in** ✅ — `https://www.data.gov.in/state_utes/Maharashtra`

## Andhra Pradesh

- State portal ✅ `https://www.ap.gov.in`
- Finance / Treasuries & IFMIS 🔎 `https://apfinance.gov.in` · CFMS: `https://cfms.ap.gov.in`
- PWD / Roads & Buildings 🔎 `https://aprandb.ap.gov.in`
- e-Procurement 🔎 `https://tender.apeprocurement.gov.in`
- DES 🔎 `https://apdes.ap.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Andhra-Pradesh`

## Arunachal Pradesh

- State portal ✅ `https://arunachalpradesh.gov.in`
- Finance 🔎 `https://finance.arunachal.gov.in`
- PWD 🔎 `https://pwd.arunachal.gov.in`
- e-Procurement 🔎 `https://arunachaltenders.gov.in`
- DES 🔎 `https://des.arunachal.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Arunachal-Pradesh`

## Assam

- State portal ✅ `https://assam.gov.in`
- Finance 🔎 `https://finance.assam.gov.in`
- PWD (Roads) 🔎 `https://pwdroads.assam.gov.in`
- e-Procurement 🔎 `https://assamtenders.gov.in`
- DES (Economics & Statistics) 🔎 `https://des.assam.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Assam`

## Bihar

- State portal ✅ `https://state.bihar.gov.in`
- Finance 🔎 `https://state.bihar.gov.in/finance`
- Road Construction Dept / PWD 🔎 `https://state.bihar.gov.in/rcd`
- e-Procurement 🔎 `https://eproc2.bihar.gov.in`
- DES 🔎 `https://state.bihar.gov.in/desbihar`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Bihar`

## Chhattisgarh

- State portal ✅ `https://cgstate.gov.in`
- Finance 🔎 `https://finance.cg.gov.in`
- PWD 🔎 `https://cgpwd.gov.in`
- e-Procurement 🔎 `https://eproc.cgstate.gov.in`
- DES 🔎 `https://descg.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Chhattisgarh`

## Goa

- State portal ✅ `https://www.goa.gov.in`
- Finance 🔎 `https://www.goa.gov.in/department/directorate-of-accounts`
- PWD 🔎 `https://pwd.goa.gov.in`
- e-Procurement 🔎 `https://eprocure.goa.gov.in`
- DES 🔎 `https://goadpse.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Goa`

## Gujarat

- State portal ✅ `https://gujaratindia.gov.in`
- Finance 🔎 `https://financedepartment.gujarat.gov.in`
- Roads & Buildings Dept 🔎 `https://rnbgujarat.gov.in`
- e-Procurement 🔎 `https://gujarat.nprocure.com` (also `https://etender.gujarat.gov.in`)
- DES 🔎 `https://ecostat.gujarat.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Gujarat`

## Haryana

- State portal ✅ `https://www.haryana.gov.in`
- Finance 🔎 `https://finhry.gov.in`
- PWD (B&R) 🔎 `https://pwdharyana.gov.in`
- e-Procurement 🔎 `https://etenders.hry.nic.in`
- DES 🔎 `https://esaharyana.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Haryana`

## Himachal Pradesh

- State portal ✅ `https://himachal.nic.in`
- Finance 🔎 `https://himachal.nic.in/finance`
- PWD (HPPWD) 🔎 `https://hppwd.hp.gov.in`
- e-Procurement 🔎 `https://hptenders.gov.in`
- DES 🔎 `https://himachalservices.nic.in/economics`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Himachal-Pradesh`

## Jharkhand

- State portal ✅ `https://www.jharkhand.gov.in`
- Finance 🔎 `https://finance.jharkhand.gov.in`
- Road Construction / PWD 🔎 `https://rcd.jharkhand.gov.in`
- e-Procurement 🔎 `https://jharkhandtenders.gov.in`
- DES 🔎 `https://jharkhand.gov.in/des`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Jharkhand`

## Karnataka

- State portal ✅ `https://www.karnataka.gov.in`
- Finance / Khajane-II (treasury) 🔎 `https://finance.karnataka.gov.in` · `https://khajane2.karnataka.gov.in`
- PWD 🔎 `https://kpwd.karnataka.gov.in`
- e-Procurement 🔎 `https://eproc.karnataka.gov.in`
- DES 🔎 `https://des.karnataka.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Karnataka`

## Kerala

- State portal ✅ `https://kerala.gov.in`
- Finance / BaMS · IFMS 🔎 `https://finance.kerala.gov.in`
- PWD 🔎 `https://www.pwd.kerala.gov.in`
- e-Procurement 🔎 `https://etenders.kerala.gov.in`
- DES (Ec. & Stats) 🔎 `https://ecostat.kerala.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Kerala`

## Madhya Pradesh

- State portal ✅ `https://www.mp.gov.in`
- Finance / IFMIS 🔎 `https://finance.mp.gov.in` · `https://mptreasury.gov.in`
- PWD 🔎 `https://mppwd.gov.in`
- e-Procurement 🔎 `https://mptenders.gov.in`
- DES 🔎 `https://des.mp.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Madhya-Pradesh`

## Manipur

- State portal ✅ `https://manipur.gov.in`
- Finance 🔎 `https://manipurfinance.gov.in`
- PWD 🔎 `https://pwd.manipur.gov.in`
- e-Procurement 🔎 `https://manipurtenders.gov.in`
- DES 🔎 `https://des.manipur.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Manipur`

## Meghalaya

- State portal ✅ `https://meghalaya.gov.in`
- Finance 🔎 `https://megfinance.gov.in`
- PWD 🔎 `https://megpwd.gov.in`
- e-Procurement 🔎 `https://meghalayatenders.gov.in`
- DES 🔎 `https://megplanning.gov.in` (Directorate of Economics & Statistics)
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Meghalaya`

## Mizoram

- State portal ✅ `https://mizoram.gov.in`
- Finance 🔎 `https://finance.mizoram.gov.in`
- PWD 🔎 `https://pwd.mizoram.gov.in`
- e-Procurement 🔎 `https://mizoramtenders.gov.in`
- DES 🔎 `https://des.mizoram.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Mizoram`

## Nagaland

- State portal ✅ `https://www.nagaland.gov.in`
- Finance 🔎 `https://finance.nagaland.gov.in`
- PWD 🔎 `https://pwd.nagaland.gov.in`
- e-Procurement 🔎 `https://nagalandtenders.gov.in`
- DES 🔎 `https://des.nagaland.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Nagaland`

## Odisha

- State portal ✅ `https://odisha.gov.in`
- Finance / IFMS 🔎 `https://finance.odisha.gov.in` · `https://ifms.odisha.gov.in`
- Works Department 🔎 `https://works.odisha.gov.in`
- e-Procurement 🔎 `https://tendersodisha.gov.in`
- DES 🔎 `https://desorissa.nic.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Odisha`

## Punjab

- State portal ✅ `https://punjab.gov.in`
- Finance / IFMS 🔎 `https://finance.punjab.gov.in` · `https://ifms.punjab.gov.in`
- PWD (B&R) 🔎 `https://pbpwd.gov.in`
- e-Procurement 🔎 `https://eproc.punjab.gov.in`
- DES 🔎 `https://esopb.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Punjab`

## Rajasthan

- State portal ✅ `https://rajasthan.gov.in`
- Finance / IFMS 🔎 `https://finance.rajasthan.gov.in` · `https://ifms.raj.nic.in`
- PWD 🔎 `https://pwd.rajasthan.gov.in`
- e-Procurement 🔎 `https://eproc.rajasthan.gov.in` · SPP portal: `https://sppp.rajasthan.gov.in`
- DES 🔎 `https://des.rajasthan.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Rajasthan`

## Sikkim

- State portal ✅ `https://sikkim.gov.in`
- Finance 🔎 `https://sikkimfinance.gov.in`
- Roads & Bridges Dept 🔎 `https://sikkimrb.gov.in`
- e-Procurement 🔎 `https://sikkimtender.gov.in`
- DES 🔎 `https://desme.sikkim.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Sikkim`

## Tamil Nadu

- State portal ✅ `https://www.tn.gov.in`
- Finance / IFHRMS 🔎 `https://fin.tn.gov.in` · `https://www.karuvoolam.tn.gov.in`
- Highways & Minor Ports / PWD 🔎 `https://www.tnhighways.tn.gov.in` · `https://www.tnpwd.gov.in`
- e-Procurement 🔎 `https://tntenders.gov.in`
- DES 🔎 `https://www.des.tn.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Tamil-Nadu`

## Telangana

- State portal ✅ `https://www.telangana.gov.in`
- Finance 🔎 `https://finance.telangana.gov.in` · treasuries: `https://treasury.telangana.gov.in`
- Roads & Buildings 🔎 `https://rnb.telangana.gov.in`
- e-Procurement 🔎 `https://tender.telangana.gov.in`
- DES 🔎 `https://des.telangana.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Telangana`

## Tripura

- State portal ✅ `https://tripura.gov.in`
- Finance 🔎 `https://finance.tripura.gov.in`
- PWD 🔎 `https://pwd.tripura.gov.in`
- e-Procurement 🔎 `https://tripuratenders.gov.in`
- DES 🔎 `https://ecostat.tripura.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Tripura`

## Uttar Pradesh

- State portal ✅ `https://up.gov.in`
- Finance / IFMS-Koshvani 🔎 `https://updfs.gov.in` · `https://koshvani.up.nic.in`
- PWD 🔎 `https://uppwd.gov.in`
- e-Procurement 🔎 `https://etender.up.nic.in`
- DES / Planning 🔎 `https://updes.up.nic.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Uttar-Pradesh`

## Uttarakhand

- State portal ✅ `https://uk.gov.in`
- Finance 🔎 `https://finance.uk.gov.in`
- PWD 🔎 `https://uttarakhandpwd.gov.in`
- e-Procurement 🔎 `https://uktenders.gov.in`
- DES 🔎 `https://des.uk.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/Uttarakhand`

## West Bengal

- State portal ✅ `https://wb.gov.in`
- Finance / IFMS 🔎 `https://wbfin.wb.gov.in` · `https://wbifms.gov.in`
- PWD 🔎 `https://pwdwb.in` (also `https://pwd.wb.gov.in`)
- e-Procurement 🔎 `https://wbtenders.gov.in`
- DES / BAES 🔎 `https://wbplan.gov.in`
- data.gov.in ✅ `https://www.data.gov.in/state_utes/West-Bengal`

---

# Union Territories

## Andaman & Nicobar Islands

- Portal ✅ `https://www.andaman.gov.in` · APWD 🔎 `https://apwd.andaman.gov.in` · e-Proc 🔎 `https://andamantenders.gov.in` · data.gov.in ✅ `.../Andaman-and-Nicobar-Islands`

## Chandigarh

- Portal ✅ `https://chandigarh.gov.in` · Engineering/PWD 🔎 `https://chdengineering.gov.in` · e-Proc 🔎 `https://etenders.chd.nic.in` · data.gov.in ✅ `.../Chandigarh`

## Dadra & Nagar Haveli and Daman & Diu

- Portal ✅ `https://dnhdd.gov.in` · PWD 🔎 `https://ddd.gov.in` · e-Proc 🔎 `https://ddtenders.gov.in` · data.gov.in ✅ `.../Dadra-and-Nagar-Haveli`

## Delhi (NCT)

- Portal ✅ `https://delhi.gov.in` · Finance 🔎 `https://finance.delhi.gov.in` · PWD 🔎 `https://pwddelhi.gov.in` · e-Proc 🔎 `https://govtprocurement.delhi.gov.in` · DES 🔎 `https://des.delhi.gov.in` · data.gov.in ✅ `.../Delhi`

## Jammu & Kashmir

- Portal ✅ `https://jk.gov.in` · Finance/PFMS-BEAMS 🔎 `https://jkfinance.jk.gov.in` · R&B / PWD 🔎 `https://jkpwdrb.nic.in` · e-Proc 🔎 `https://jktenders.gov.in` · DES 🔎 `https://ecostatjk.nic.in` · data.gov.in ✅ `.../Jammu-and-Kashmir`

## Ladakh

- Portal ✅ `https://ladakh.gov.in` · PWD 🔎 `https://pwd.ladakh.gov.in` · e-Proc 🔎 `https://ladakhtenders.gov.in` · data.gov.in ✅ `.../Ladakh`

## Lakshadweep

- Portal ✅ `https://lakshadweep.gov.in` · PWD 🔎 `https://pwd.utl.gov.in` · e-Proc 🔎 `https://lakshadweeptenders.gov.in`

## Puducherry

- Portal ✅ `https://py.gov.in` · Finance 🔎 `https://finance.py.gov.in` · PWD 🔎 `https://pwd.py.gov.in` · e-Proc 🔎 `https://pudutenders.gov.in` · DES 🔎 `https://des.py.gov.in` · data.gov.in ✅ `.../Puducherry`

---

# Recommended order for the MVP

**Phase 1 (Roads — Maharashtra):** Maharashtra PWD → Mahatenders → MRSAC → MARS → Maharashtra State Data Bank.

**Phase 2 (Finance — Maharashtra):** Mahakosh → Finance Department → Economic Survey → DES.

**Phase 3 (Central):** data.gov.in → India Budget → MoRTH → CAG → CGA/PFMS → NDAP.

**Phase 4+ (Other states):** replicate the per-state block, starting with the largest road programs (UP, MP, Rajasthan, Karnataka, Tamil Nadu), reusing the same connector templates ([14](../15-scalability/scalability-plan.md)).

# Cross-cutting central sources for every state

Regardless of state, these give comparable, standardized data and should back-fill state gaps:
`data.gov.in` (state pages) · `NDAP` · `PFMS` (releases/expenditure) · `OMMAS/PMGSY` (rural roads) · `MoRTH` (highways) · `CPPP/GeM` (tenders) · `RBI DBIE` (state finances/SDL borrowings) · `CAG` (state audit reports).

# Datasets to build (canonical tables → see [04](../05-data-model/database-design.md))

```text
ministries · departments · districts · roads · bridges · contracts · tenders ·
contractors · budget_allocations (allocation) · fund_releases (release) ·
expenditure · revenue (tax/gst/excise/borrowing/grants) · tax_collection ·
audit_reports (report) · project_status (project_progress) · anomalies
```

# Gold mine (highest priority to wire first)

1. Maharashtra State Data Bank 2. Maharashtra PWD 3. Mahatenders 4. Mahakosh
2. data.gov.in 6. CGA / PFMS 7. CAG 8. MRSAC 9. MoRTH 10. NDAP

---

## Machine-readable registry (for `sources/*.yaml`)

Every entry above becomes a `data_source` row ([04](../05-data-model/database-design.md)) and a `sources/<id>.yaml` connector definition ([03](../04-data-engineering/data-collection-architecture.md)). Suggested `id` convention: `<tier>_<state>_<subject>`, e.g. `state_mh_pwd_works`, `state_up_finance_ifms`, `central_morth_projects`, `central_cga_pfms`. Each YAML records the **confirmed** URL, access type (api/csv/xls/pdf/scrape), cadence, license, and field map — the ✅/🔎 status here is only a starting hint; the connector's first successful run is what marks a URL verified.
