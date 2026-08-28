/**
 * Demo works, tenders, timelines and documents.
 *
 * Corridors are named after real Nagpur and Pune roads so the map reads as a
 * map; the works, values, firms, officers and tenders on them are invented.
 * `DEMO_DATA_NOTICE` is rendered on every surface that shows one of these
 * records, and no figure carries a citation to a real authority.
 */
import type { OfficerAssociation, OfficerRole } from "@/domain/organisation";
import type {
  DocumentAvailability,
  DocumentKind,
  InfrastructureType,
  ProjectDocument,
  ProjectEvent,
  ProjectStatus,
  ProjectSummary,
  Tender,
} from "@/domain/project";
import { demoAmount, demoMissingAmount } from "./sources";
import type { Position } from "geojson";

interface Seed {
  readonly id: string;
  readonly externalId: string;
  readonly name: string;
  readonly infrastructureType: InfrastructureType;
  readonly status: ProjectStatus;
  readonly stateCode: string;
  readonly districtId: string;
  readonly localBodyId: string | null;
  readonly departmentId: string;
  readonly contractorId: string | null;
  readonly lengthKm: number | null;
  readonly fiscalYear: string;
  readonly sourceId: number;
  /** Rupees as a decimal string; null where the record carries no award value. */
  readonly contractValue: string | null;
  readonly estimatedCost: string | null;
  readonly tender: {
    readonly externalId: string;
    readonly publishedOn: string;
    readonly bidsCloseOn: string | null;
    readonly method: Tender["method"];
    readonly bidderCount: number | null;
    readonly awardedOn: string | null;
  } | null;
  readonly startedOn: string | null;
  readonly expectedOn: string | null;
  readonly completedOn: string | null;
  readonly officers: readonly (readonly [string, OfficerRole])[];
  readonly coordinates: readonly Position[];
}

const PWD_OFFICERS = [
  ["OFF-1001", "executive_engineer"],
  ["OFF-1002", "approving_authority"],
  ["OFF-1003", "project_engineer"],
  ["OFF-1004", "supervising_authority"],
] as const;

const MUNICIPAL_OFFICERS = [
  ["OFF-1004", "executive_engineer"],
  ["OFF-1005", "approving_authority"],
  ["OFF-1003", "project_engineer"],
] as const;

const RURAL_OFFICERS = [
  ["OFF-1006", "executive_engineer"],
  ["OFF-1002", "approving_authority"],
] as const;

const SEEDS: readonly Seed[] = [
  {
    id: "p-501",
    externalId: "PWD-NAG-2023-00142",
    name: "Wardha Road Improvement Project",
    infrastructureType: "road",
    status: "completed",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-pwd-mh",
    contractorId: "COMP-000128",
    lengthKm: 8.4,
    fiscalYear: "FY2022-23",
    sourceId: 9101,
    contractValue: "482000000.00",
    estimatedCost: "520000000.00",
    tender: {
      externalId: "PWD/NAG/2022/1847",
      publishedOn: "2022-01-10",
      bidsCloseOn: "2022-01-28",
      method: "open_tender",
      bidderCount: 7,
      awardedOn: "2022-02-15",
    },
    startedOn: "2022-03-12",
    expectedOn: "2023-09-30",
    completedOn: "2023-11-18",
    officers: PWD_OFFICERS,
    coordinates: [
      [79.0782, 21.1372],
      [79.0721, 21.1189],
      [79.0648, 21.0951],
      [79.0554, 21.0688],
      [79.0463, 21.0402],
    ],
  },
  {
    id: "p-502",
    externalId: "PWD-NAG-2023-00187",
    name: "Amravati Road Widening (Phase II)",
    infrastructureType: "road",
    status: "in_progress",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-pwd-mh",
    contractorId: "COMP-000512",
    lengthKm: 6.1,
    fiscalYear: "FY2023-24",
    sourceId: 9101,
    contractValue: "614000000.00",
    estimatedCost: "598000000.00",
    tender: {
      externalId: "PWD/NAG/2023/2210",
      publishedOn: "2023-04-04",
      bidsCloseOn: "2023-04-25",
      method: "open_tender",
      bidderCount: 5,
      awardedOn: "2023-05-19",
    },
    startedOn: "2023-06-26",
    expectedOn: "2025-03-31",
    completedOn: null,
    officers: PWD_OFFICERS,
    coordinates: [
      [79.0742, 21.1503],
      [79.0521, 21.1548],
      [79.0288, 21.1591],
      [79.0013, 21.1622],
      [78.9762, 21.1638],
    ],
  },
  {
    id: "p-503",
    externalId: "NMC-RD-2023-0412",
    name: "Kamptee Road Resurfacing",
    infrastructureType: "road",
    status: "completed",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-nmc-works",
    contractorId: "COMP-000341",
    lengthKm: 4.2,
    fiscalYear: "FY2023-24",
    sourceId: 9104,
    contractValue: "126000000.00",
    estimatedCost: "131000000.00",
    tender: {
      externalId: "NMC/WW/2023/0771",
      publishedOn: "2023-05-16",
      bidsCloseOn: "2023-06-02",
      method: "open_tender",
      bidderCount: 4,
      awardedOn: "2023-06-21",
    },
    startedOn: "2023-07-10",
    expectedOn: "2024-02-29",
    completedOn: "2024-02-16",
    officers: MUNICIPAL_OFFICERS,
    coordinates: [
      [79.0961, 21.1621],
      [79.1132, 21.1804],
      [79.1318, 21.1988],
      [79.1502, 21.2166],
    ],
  },
  {
    id: "p-504",
    externalId: "PWD-NAG-2024-00061",
    name: "Hingna Road Strengthening",
    infrastructureType: "road",
    status: "behind_recorded_schedule",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-pwd-mh",
    contractorId: "COMP-000128",
    lengthKm: 9.8,
    fiscalYear: "FY2023-24",
    sourceId: 9101,
    contractValue: "579000000.00",
    estimatedCost: "561000000.00",
    tender: {
      externalId: "PWD/NAG/2023/2488",
      publishedOn: "2023-08-08",
      bidsCloseOn: "2023-08-30",
      method: "open_tender",
      bidderCount: 6,
      awardedOn: "2023-09-22",
    },
    startedOn: "2023-10-16",
    expectedOn: "2025-01-31",
    completedOn: null,
    officers: PWD_OFFICERS,
    coordinates: [
      [79.0538, 21.1247],
      [79.0301, 21.1102],
      [79.0062, 21.0961],
      [78.9814, 21.0836],
      [78.9571, 21.0742],
    ],
  },
  {
    id: "p-505",
    externalId: "NMC-RD-2024-0088",
    name: "Katol Road Junction Improvement",
    infrastructureType: "road",
    status: "in_progress",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-nmc-works",
    contractorId: "COMP-000512",
    lengthKm: 2.3,
    fiscalYear: "FY2024-25",
    sourceId: 9104,
    contractValue: "84000000.00",
    estimatedCost: "88000000.00",
    tender: {
      externalId: "NMC/WW/2024/0142",
      publishedOn: "2024-04-11",
      bidsCloseOn: "2024-05-02",
      method: "open_tender",
      bidderCount: 3,
      awardedOn: "2024-05-24",
    },
    startedOn: "2024-06-18",
    expectedOn: "2025-06-30",
    completedOn: null,
    officers: MUNICIPAL_OFFICERS,
    coordinates: [
      [79.0648, 21.1668],
      [79.0421, 21.1889],
      [79.0208, 21.2114],
      [79.0034, 21.2331],
    ],
  },
  {
    id: "p-506",
    externalId: "PWD-NAG-2024-00120",
    name: "Umred Road Corridor Upgrade",
    infrastructureType: "road",
    status: "proposed",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-pwd-mh",
    contractorId: null,
    lengthKm: 11.2,
    fiscalYear: "FY2025-26",
    sourceId: 9101,
    contractValue: null,
    estimatedCost: "742000000.00",
    tender: null,
    startedOn: null,
    expectedOn: null,
    completedOn: null,
    officers: [["OFF-1002", "approving_authority"]],
    coordinates: [
      [79.1042, 21.1281],
      [79.1338, 21.1042],
      [79.1621, 21.0796],
      [79.1904, 21.0552],
      [79.2188, 21.0301],
    ],
  },
  {
    id: "p-507",
    externalId: "NMC-RD-2022-0271",
    name: "Central Avenue Carriageway Repair",
    infrastructureType: "road",
    status: "completed",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-nmc-works",
    contractorId: "COMP-000341",
    lengthKm: 3.1,
    fiscalYear: "FY2022-23",
    sourceId: 9104,
    contractValue: "97000000.00",
    estimatedCost: "94000000.00",
    tender: {
      externalId: "NMC/WW/2022/0508",
      publishedOn: "2022-06-13",
      bidsCloseOn: "2022-07-01",
      method: "limited_tender",
      bidderCount: 3,
      awardedOn: "2022-07-19",
    },
    startedOn: "2022-08-08",
    expectedOn: "2023-03-31",
    completedOn: "2023-03-12",
    officers: MUNICIPAL_OFFICERS,
    coordinates: [
      [79.0884, 21.1494],
      [79.1024, 21.1481],
      [79.1168, 21.1466],
      [79.1301, 21.1452],
    ],
  },
  {
    id: "p-508",
    externalId: "PWD-NAG-2023-00205",
    name: "Outer Ring Road Flyover (Package 3)",
    infrastructureType: "flyover",
    status: "in_progress",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-pwd-mh",
    contractorId: "COMP-000128",
    lengthKm: 1.9,
    fiscalYear: "FY2023-24",
    sourceId: 9103,
    contractValue: "945000000.00",
    estimatedCost: "912000000.00",
    tender: {
      externalId: "PWD/NAG/2023/2301",
      publishedOn: "2023-06-05",
      bidsCloseOn: "2023-06-28",
      method: "open_tender",
      bidderCount: 8,
      awardedOn: "2023-07-24",
    },
    startedOn: "2023-08-21",
    expectedOn: "2026-03-31",
    completedOn: null,
    officers: PWD_OFFICERS,
    coordinates: [
      [79.1189, 21.1004],
      [79.1268, 21.1088],
      [79.1341, 21.1176],
    ],
  },
  {
    id: "p-509",
    externalId: "NMC-RD-2023-0501",
    name: "Nag River Crossing Bridge",
    infrastructureType: "bridge",
    status: "records_incomplete",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-nmc",
    departmentId: "dept-nmc-works",
    contractorId: null,
    lengthKm: 0.4,
    fiscalYear: "FY2023-24",
    sourceId: 9104,
    contractValue: null,
    estimatedCost: null,
    tender: null,
    startedOn: null,
    expectedOn: null,
    completedOn: null,
    officers: [],
    coordinates: [
      [79.0921, 21.1408],
      [79.0958, 21.1381],
    ],
  },
  {
    id: "p-510",
    externalId: "RDD-NAG-2023-0914",
    name: "Khapa–Saoner Rural Link Road",
    infrastructureType: "road",
    status: "completed",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-gp-khapa",
    departmentId: "dept-rural-mh",
    contractorId: "COMP-000341",
    lengthKm: 7.6,
    fiscalYear: "FY2022-23",
    sourceId: 9105,
    contractValue: "68000000.00",
    estimatedCost: "71000000.00",
    tender: {
      externalId: "RDD/NAG/2022/0318",
      publishedOn: "2022-09-12",
      bidsCloseOn: "2022-10-04",
      method: "open_tender",
      bidderCount: 4,
      awardedOn: "2022-10-27",
    },
    startedOn: "2022-11-21",
    expectedOn: "2023-08-31",
    completedOn: "2023-08-14",
    officers: RURAL_OFFICERS,
    coordinates: [
      [78.9412, 21.4381],
      [78.9698, 21.4602],
      [78.9964, 21.4818],
      [79.0221, 21.5024],
    ],
  },
  {
    id: "p-511",
    externalId: "RDD-NAG-2024-1102",
    name: "Mowad Approach Road Upgrade",
    infrastructureType: "road",
    status: "in_progress",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-mowad",
    departmentId: "dept-rural-mh",
    contractorId: "COMP-000512",
    lengthKm: 4.4,
    fiscalYear: "FY2024-25",
    sourceId: 9105,
    contractValue: "42000000.00",
    estimatedCost: "44000000.00",
    tender: {
      externalId: "RDD/NAG/2024/0611",
      publishedOn: "2024-05-20",
      bidsCloseOn: "2024-06-11",
      method: "open_tender",
      bidderCount: 3,
      awardedOn: "2024-07-02",
    },
    startedOn: "2024-08-05",
    expectedOn: "2025-09-30",
    completedOn: null,
    officers: RURAL_OFFICERS,
    coordinates: [
      [78.6892, 21.3612],
      [78.7134, 21.3801],
      [78.7386, 21.3994],
      [78.7601, 21.4142],
    ],
  },
  {
    id: "p-512",
    externalId: "RDD-NAG-2023-0977",
    name: "Kamptee–Kanhan Connector",
    infrastructureType: "road",
    status: "behind_recorded_schedule",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: "lb-kamptee",
    departmentId: "dept-rural-mh",
    contractorId: "COMP-000341",
    lengthKm: 5.9,
    fiscalYear: "FY2023-24",
    sourceId: 9105,
    contractValue: "55000000.00",
    estimatedCost: "52000000.00",
    tender: {
      externalId: "RDD/NAG/2023/0422",
      publishedOn: "2023-07-18",
      bidsCloseOn: "2023-08-09",
      method: "open_tender",
      bidderCount: 2,
      awardedOn: "2023-08-31",
    },
    startedOn: "2023-09-25",
    expectedOn: "2024-11-30",
    completedOn: null,
    officers: RURAL_OFFICERS,
    coordinates: [
      [79.1802, 21.2214],
      [79.2011, 21.2436],
      [79.2224, 21.2661],
      [79.2408, 21.2848],
    ],
  },
  {
    id: "p-513",
    externalId: "NHA-MH-2023-0034",
    name: "Nagpur–Bhandara Corridor (Package 2)",
    infrastructureType: "highway",
    status: "in_progress",
    stateCode: "27",
    districtId: "27-505",
    localBodyId: null,
    departmentId: "dept-nha",
    contractorId: "COMP-000128",
    lengthKm: 38.5,
    fiscalYear: "FY2023-24",
    sourceId: 9106,
    contractValue: "4120000000.00",
    estimatedCost: "4008000000.00",
    tender: {
      externalId: "NHA/MH/2023/0034",
      publishedOn: "2023-02-14",
      bidsCloseOn: "2023-03-21",
      method: "open_tender",
      bidderCount: 11,
      awardedOn: "2023-04-28",
    },
    startedOn: "2023-06-12",
    expectedOn: "2026-05-31",
    completedOn: null,
    officers: [
      ["OFF-1007", "executive_engineer"],
      ["OFF-1002", "approving_authority"],
    ],
    coordinates: [
      [79.1488, 21.1682],
      [79.2312, 21.1888],
      [79.3164, 21.2094],
      [79.4021, 21.2288],
      [79.4876, 21.2461],
      [79.5488, 21.2578],
    ],
  },
  {
    id: "p-514",
    externalId: "PWD-PUN-2023-00344",
    name: "Pune Ring Road (Package 7)",
    infrastructureType: "highway",
    status: "in_progress",
    stateCode: "27",
    districtId: "27-521",
    localBodyId: "lb-pmc",
    departmentId: "dept-pwd-mh",
    contractorId: "COMP-000341",
    lengthKm: 14.2,
    fiscalYear: "FY2023-24",
    sourceId: 9101,
    contractValue: "2680000000.00",
    estimatedCost: "2712000000.00",
    tender: {
      externalId: "PWD/PUN/2023/0912",
      publishedOn: "2023-03-06",
      bidsCloseOn: "2023-04-03",
      method: "open_tender",
      bidderCount: 9,
      awardedOn: "2023-05-02",
    },
    startedOn: "2023-06-19",
    expectedOn: "2026-01-31",
    completedOn: null,
    officers: [
      ["OFF-1008", "executive_engineer"],
      ["OFF-1002", "approving_authority"],
    ],
    coordinates: [
      [73.7884, 18.4712],
      [73.8221, 18.4508],
      [73.8562, 18.4331],
      [73.8901, 18.4188],
    ],
  },
  {
    id: "p-515",
    externalId: "PWD-PUN-2024-00412",
    name: "Pimpri Arterial Road Resurfacing",
    infrastructureType: "road",
    status: "completed",
    stateCode: "27",
    districtId: "27-521",
    localBodyId: "lb-pcmc",
    departmentId: "dept-pwd-mh",
    contractorId: "COMP-000512",
    lengthKm: 5.3,
    fiscalYear: "FY2024-25",
    sourceId: 9101,
    contractValue: "189000000.00",
    estimatedCost: "196000000.00",
    tender: {
      externalId: "PWD/PUN/2024/1104",
      publishedOn: "2024-04-22",
      bidsCloseOn: "2024-05-14",
      method: "open_tender",
      bidderCount: 6,
      awardedOn: "2024-06-06",
    },
    startedOn: "2024-07-01",
    expectedOn: "2025-03-31",
    completedOn: "2025-03-18",
    officers: [
      ["OFF-1008", "executive_engineer"],
      ["OFF-1002", "approving_authority"],
    ],
    coordinates: [
      [73.7712, 18.6188],
      [73.7988, 18.6341],
      [73.8264, 18.6502],
      [73.8492, 18.6644],
    ],
  },
  {
    id: "p-516",
    externalId: "PWD-BPL-2023-00219",
    name: "Sample City Arterial Upgrade",
    infrastructureType: "road",
    status: "completed",
    stateCode: "23",
    districtId: "23-444",
    localBodyId: "lb-bmc-bhopal",
    departmentId: "dept-pwd-mp",
    contractorId: "COMP-000128",
    lengthKm: 6.7,
    fiscalYear: "FY2022-23",
    sourceId: 9101,
    contractValue: "315000000.00",
    estimatedCost: "308000000.00",
    tender: {
      externalId: "PWD/BPL/2022/0771",
      publishedOn: "2022-08-19",
      bidsCloseOn: "2022-09-12",
      method: "open_tender",
      bidderCount: 5,
      awardedOn: "2022-10-04",
    },
    startedOn: "2022-11-14",
    expectedOn: "2023-10-31",
    completedOn: "2023-10-22",
    officers: [["OFF-1002", "approving_authority"]],
    coordinates: [
      [77.3488, 23.2214],
      [77.3801, 23.2402],
      [77.4118, 23.2588],
      [77.4402, 23.2744],
    ],
  },
];

function toProject(seed: Seed): ProjectSummary {
  return {
    id: seed.id,
    externalId: seed.externalId,
    name: seed.name,
    infrastructureType: seed.infrastructureType,
    status: seed.status,
    stateCode: seed.stateCode,
    districtId: seed.districtId,
    localBodyId: seed.localBodyId,
    departmentId: seed.departmentId,
    contractorId: seed.contractorId,
    contractValue:
      seed.contractValue === null
        ? demoMissingAmount(
            seed.status === "proposed"
              ? "No award value — the work is listed as proposed and no contract has been recorded"
              : "Award value not present in the records held",
            "Work order abstract, Example State Public Works Department",
          )
        : demoAmount(seed.contractValue, seed.sourceId),
    lengthKm: seed.lengthKm,
    fiscalYear: seed.fiscalYear,
    geometry: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: [...seed.coordinates] },
    },
  };
}

function toTender(seed: Seed): Tender | null {
  if (seed.tender === null) return null;
  return {
    id: `t-${seed.id}`,
    externalId: seed.tender.externalId,
    projectId: seed.id,
    publishedOn: seed.tender.publishedOn,
    bidsCloseOn: seed.tender.bidsCloseOn,
    method: seed.tender.method,
    estimatedCost:
      seed.estimatedCost === null
        ? demoMissingAmount(
            "Estimated cost not present in the records held",
            "Tender notice register",
          )
        : demoAmount(seed.estimatedCost, 9102),
    awardedValue:
      seed.contractValue === null
        ? demoMissingAmount("No award recorded against this tender", "Work order abstract")
        : demoAmount(seed.contractValue, seed.sourceId),
    bidderCount: seed.tender.bidderCount,
    awardedToCompanyId: seed.contractorId,
    invitingAuthorityOfficerId:
      seed.officers.find(([, role]) => role === "approving_authority")?.[0] ?? null,
  };
}

function toTimeline(seed: Seed): readonly ProjectEvent[] {
  const events: ProjectEvent[] = [];
  const t = seed.tender;
  if (t !== null) {
    events.push({
      kind: "tender_published",
      date: t.publishedOn,
      recorded: true,
      sourceDocumentId: 9102,
    });
    if (t.bidsCloseOn !== null) {
      events.push({
        kind: "bids_closed",
        date: t.bidsCloseOn,
        recorded: true,
        sourceDocumentId: 9102,
      });
    }
    if (t.awardedOn !== null) {
      events.push({
        kind: "contract_awarded",
        date: t.awardedOn,
        recorded: true,
        sourceDocumentId: 9103,
      });
    }
  }
  if (seed.startedOn !== null) {
    events.push({
      kind: "work_started",
      date: seed.startedOn,
      recorded: true,
      sourceDocumentId: 9103,
    });
  }
  if (seed.expectedOn !== null) {
    // `recorded: false` — a scheduled date is a plan in a document, not an event
    // that occurred. The timeline renders the two differently on purpose.
    events.push({
      kind: "expected_completion",
      date: seed.expectedOn,
      recorded: false,
      sourceDocumentId: seed.sourceId,
    });
  }
  if (seed.completedOn !== null) {
    events.push({
      kind: "completed",
      date: seed.completedOn,
      recorded: true,
      sourceDocumentId: 9107,
    });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

interface DocumentSeed {
  readonly kind: DocumentKind;
  readonly title: string;
  readonly format: ProjectDocument["format"];
  readonly documentDate: string | null;
  readonly availability: DocumentAvailability;
  readonly sourceDocumentId: number | null;
}

function doc(seed: Seed, document: DocumentSeed): ProjectDocument {
  return {
    id: `${seed.id}-${document.kind}`,
    projectId: seed.id,
    issuedBy:
      seed.departmentId === "dept-nmc-works"
        ? "Example Municipal Corporation"
        : "Example State Public Works Department",
    ...document,
  };
}

function toDocuments(seed: Seed): readonly ProjectDocument[] {
  const documents: ProjectDocument[] = [];
  if (seed.tender !== null) {
    documents.push(
      doc(seed, {
        kind: "tender_notice",
        title: `Tender notice ${seed.tender.externalId}`,
        format: "pdf",
        documentDate: seed.tender.publishedOn,
        availability: "held",
        sourceDocumentId: 9102,
      }),
      doc(seed, {
        kind: "agreement",
        title: "Contract agreement",
        format: "pdf",
        documentDate: seed.tender.awardedOn,
        availability: "referenced_not_held",
        sourceDocumentId: null,
      }),
    );
  }
  if (seed.startedOn !== null) {
    documents.push(
      doc(seed, {
        kind: "work_order",
        title: "Work order",
        format: "scan",
        documentDate: seed.startedOn,
        availability: "held",
        sourceDocumentId: 9103,
      }),
    );
  }
  documents.push(
    doc(seed, {
      kind: "project_report",
      title: "Detailed project report",
      format: "pdf",
      documentDate: null,
      availability: "not_published",
      sourceDocumentId: null,
    }),
    doc(seed, {
      kind: "payment_record",
      title: "Running account payments",
      format: "xls",
      documentDate: null,
      availability: "referenced_not_held",
      sourceDocumentId: null,
    }),
  );
  if (seed.completedOn !== null) {
    documents.push(
      doc(seed, {
        kind: "completion_certificate",
        title: "Completion certificate",
        format: "pdf",
        documentDate: seed.completedOn,
        availability: "held",
        sourceDocumentId: 9107,
      }),
    );
  }
  return documents;
}

function toOfficerAssociations(seed: Seed): readonly OfficerAssociation[] {
  return seed.officers.map(([officerId, role]) => ({
    officerId,
    role,
    periodFrom: seed.tender?.awardedOn ?? seed.startedOn,
    periodTo: seed.completedOn,
    sourceDocumentId: 9103,
  }));
}

export interface DemoProjectRecord {
  readonly project: ProjectSummary;
  readonly tender: Tender | null;
  readonly timeline: readonly ProjectEvent[];
  readonly documents: readonly ProjectDocument[];
  readonly officers: readonly OfficerAssociation[];
}

export const DEMO_PROJECTS: readonly DemoProjectRecord[] = SEEDS.map((seed) => ({
  project: toProject(seed),
  tender: toTender(seed),
  timeline: toTimeline(seed),
  documents: toDocuments(seed),
  officers: toOfficerAssociations(seed),
}));
