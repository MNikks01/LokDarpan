/**
 * Demo departments, firms and officers.
 *
 * Every name is fictional. Firms are "Example / Sample / Demo …" and officers
 * are placeholder names, because a realistic-looking firm attached to
 * fabricated contract values is indistinguishable from an allegation once a
 * screenshot leaves the page.
 */
import type { Company, GovernmentDepartment, GovernmentOfficer } from "@/domain/organisation";

export const DEMO_DEPARTMENTS: readonly GovernmentDepartment[] = [
  {
    id: "dept-pwd-mh",
    name: "Example State Public Works Department",
    shortName: "PWD",
    tier: "state",
    stateCode: "27",
    parentMinistry: null,
  },
  {
    id: "dept-rural-mh",
    name: "Example Rural Development Department",
    shortName: "Rural Development",
    tier: "state",
    stateCode: "27",
    parentMinistry: null,
  },
  {
    id: "dept-nmc-works",
    name: "Example Municipal Corporation — Works Wing",
    shortName: "Municipal Works",
    tier: "local",
    stateCode: "27",
    parentMinistry: null,
  },
  {
    id: "dept-nha",
    name: "Example National Highways Authority",
    shortName: "Highways Authority",
    tier: "central",
    stateCode: null,
    parentMinistry: "Example Ministry of Road Transport",
  },
  {
    id: "dept-transport",
    name: "Example Ministry of Road Transport",
    shortName: "Road Transport",
    tier: "central",
    stateCode: null,
    parentMinistry: null,
  },
  {
    id: "dept-pwd-mp",
    name: "Sample State Public Works Department",
    shortName: "PWD",
    tier: "state",
    stateCode: "23",
    parentMinistry: null,
  },
];

export const DEMO_COMPANIES: readonly Company[] = [
  {
    id: "COMP-000128",
    name: "Example Infrastructure Pvt Ltd",
    registrationId: "Demo registration — not a registry entry",
    registeredOfficeCity: "Nagpur",
    registeredOfficeStateCode: "27",
  },
  {
    id: "COMP-000341",
    name: "Sample Engineering Works Ltd",
    registrationId: "Demo registration — not a registry entry",
    registeredOfficeCity: "Pune",
    registeredOfficeStateCode: "27",
  },
  {
    id: "COMP-000512",
    name: "Demo Roadways & Civil Pvt Ltd",
    registrationId: "Demo registration — not a registry entry",
    registeredOfficeCity: "Nagpur",
    registeredOfficeStateCode: "27",
  },
  {
    id: "COMP-000733",
    name: "Illustrative Constructions Pvt Ltd",
    registrationId: "Demo registration — not a registry entry",
    registeredOfficeCity: "Bhopal",
    registeredOfficeStateCode: "23",
  },
];

export const DEMO_OFFICERS: readonly GovernmentOfficer[] = [
  {
    id: "OFF-1001",
    name: "Example Officer A",
    designation: "Executive Engineer",
    departmentId: "dept-pwd-mh",
    office: "Public Works Division, Nagpur",
  },
  {
    id: "OFF-1002",
    name: "Example Officer B",
    designation: "Superintending Engineer",
    departmentId: "dept-pwd-mh",
    office: "Public Works Circle, Nagpur",
  },
  {
    id: "OFF-1003",
    name: "Example Officer C",
    designation: "Deputy Engineer",
    departmentId: "dept-pwd-mh",
    office: "Public Works Sub-Division, Nagpur (South)",
  },
  {
    id: "OFF-1004",
    name: "Example Officer D",
    designation: "City Engineer",
    departmentId: "dept-nmc-works",
    office: "Municipal Corporation, Nagpur",
  },
  {
    id: "OFF-1005",
    name: "Example Officer E",
    designation: "Additional City Engineer",
    departmentId: "dept-nmc-works",
    office: "Municipal Corporation, Nagpur",
  },
  {
    id: "OFF-1006",
    name: "Example Officer F",
    designation: "Executive Engineer",
    departmentId: "dept-rural-mh",
    office: "Rural Works Division, Nagpur",
  },
  {
    id: "OFF-1007",
    name: "Example Officer G",
    designation: "Project Director",
    departmentId: "dept-nha",
    office: "Project Implementation Unit, Nagpur",
  },
  {
    id: "OFF-1008",
    name: "Example Officer H",
    designation: "Executive Engineer",
    departmentId: "dept-pwd-mh",
    office: "Public Works Division, Pune",
  },
];
