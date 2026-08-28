/**
 * Demo local bodies.
 *
 * Local-body BOUNDARIES are the honest gap here. No public register we have
 * reviewed publishes municipal or panchayat polygons in a usable form
 * (`.docs/06-government-sources/SOURCE-DISCOVERY-REPORT.md`), so `boundaryAvailable`
 * is false and the map frames the body by extent instead of drawing an outline.
 * Inventing a plausible municipal boundary would be a fabricated fact wearing a
 * cartographic disguise — the map states the absence instead.
 */
import type { LocalBody } from "@/domain/geography";

const NAGPUR = "27-505";
const PUNE = "27-521";
const BHOPAL = "23-444";

export const DEMO_LOCAL_BODIES: readonly LocalBody[] = [
  {
    id: "lb-nmc",
    districtId: NAGPUR,
    stateCode: "27",
    name: "Nagpur Municipal Corporation",
    slug: "nagpur-municipal-corporation",
    type: "municipal_corporation",
    focusBbox: [78.99, 21.05, 79.19, 21.22],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
  {
    id: "lb-kamptee",
    districtId: NAGPUR,
    stateCode: "27",
    name: "Kamptee Municipal Council",
    slug: "kamptee-municipal-council",
    type: "municipal_council",
    focusBbox: [79.16, 21.19, 79.26, 21.28],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
  {
    id: "lb-mowad",
    districtId: NAGPUR,
    stateCode: "27",
    name: "Mowad Nagar Panchayat",
    slug: "mowad-nagar-panchayat",
    type: "nagar_panchayat",
    focusBbox: [78.68, 21.35, 78.78, 21.44],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
  {
    id: "lb-gp-khapa",
    districtId: NAGPUR,
    stateCode: "27",
    name: "Khapa Gram Panchayat",
    slug: "khapa-gram-panchayat",
    type: "gram_panchayat",
    focusBbox: [78.9, 21.42, 79.02, 21.52],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
  {
    id: "lb-zp-nagpur",
    districtId: NAGPUR,
    stateCode: "27",
    name: "Nagpur Zilla Parishad",
    slug: "nagpur-zilla-parishad",
    type: "zilla_parishad",
    focusBbox: [78.36, 20.66, 79.55, 21.65],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
  {
    id: "lb-pmc",
    districtId: PUNE,
    stateCode: "27",
    name: "Pune Municipal Corporation",
    slug: "pune-municipal-corporation",
    type: "municipal_corporation",
    focusBbox: [73.75, 18.44, 73.96, 18.6],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
  {
    id: "lb-pcmc",
    districtId: PUNE,
    stateCode: "27",
    name: "Pimpri-Chinchwad Municipal Corporation",
    slug: "pimpri-chinchwad-municipal-corporation",
    type: "municipal_corporation",
    focusBbox: [73.72, 18.58, 73.88, 18.71],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
  {
    id: "lb-bmc-bhopal",
    districtId: BHOPAL,
    stateCode: "23",
    name: "Sample City Municipal Corporation",
    slug: "sample-city-municipal-corporation",
    type: "municipal_corporation",
    focusBbox: [77.3, 23.18, 77.51, 23.32],
    boundaryAvailable: false,
    boundarySource: "Local Government Directory, Ministry of Panchayati Raj",
  },
];
