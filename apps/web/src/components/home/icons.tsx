import type React from "react";

/**
 * Line icons for the homepage, drawn inline so the page adds no icon library.
 * Decorative throughout: every icon sits beside a word that says the same
 * thing, so each is hidden from assistive technology.
 */

export type IconName =
  | "place"
  | "audit"
  | "tender"
  | "work"
  | "contractor"
  | "expenditure"
  | "state"
  | "district"
  | "local"
  | "citizens"
  | "journalists"
  | "researchers"
  | "developers"
  | "civil"
  | "figure"
  | "quote"
  | "page"
  | "report"
  | "file"
  | "check"
  | "arrow";

const PATHS: Readonly<Record<IconName, React.JSX.Element>> = {
  place: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  audit: (
    <>
      <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20Z" />
      <path d="M14 3.5V8h4" />
      <path d="m9.5 14 2 2 3.5-4" />
    </>
  ),
  tender: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="1.5" />
      <path d="M8 3v4M16 3v4M4 10h16M8 14h5M8 17h8" />
    </>
  ),
  work: (
    <>
      <path d="M3 20h18" />
      <path d="M5 20V11l7-5 7 5v9" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  contractor: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="1.5" />
      <path d="M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3.5 12.5h17" />
    </>
  ),
  expenditure: <path d="M7 5h10M7 9h10M13 5c2.5 0 4 1.6 4 4s-1.5 4-4 4H8l7 6" />,
  state: (
    <>
      <path d="M4 7.5 9 4l6 3 5-2.5v12L15 19l-6-3-5 3Z" />
      <path d="M9 4v12M15 7v12" />
    </>
  ),
  district: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 12h16M12 4v16" />
    </>
  ),
  local: <path d="M4 20V10l4-3 4 3v10M12 20v-7l4-3 4 3v7M3 20h18" />,
  citizens: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
    </>
  ),
  journalists: (
    <>
      <path d="M4 5.5h13v14H6a2 2 0 0 1-2-2Z" />
      <path d="M17 9h3v8.5a2 2 0 0 1-2 2M7.5 9h6M7.5 12.5h6M7.5 16h4" />
    </>
  ),
  researchers: (
    <>
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 5 5" />
    </>
  ),
  developers: <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13" />,
  civil: (
    <>
      <circle cx="8" cy="9" r="2.8" />
      <circle cx="16.5" cy="9" r="2.8" />
      <path d="M3 19c.5-2.8 2.5-4.5 5-4.5s4.5 1.7 5 4.5M12.5 15.2c1-.5 2.4-.7 4-.7 2.5 0 4.5 1.7 5 4.5" />
    </>
  ),
  figure: <path d="M7 5h10M7 9h10M13 5c2.5 0 4 1.6 4 4s-1.5 4-4 4H8l7 6" />,
  quote: (
    <>
      <path d="M5 18v-4.5C5 9.5 6.5 7 10 6M14 18v-4.5c0-4 1.5-6.5 5-7.5" />
      <path d="M5 13.5h4V18H5ZM14 13.5h4V18h-4Z" />
    </>
  ),
  page: (
    <>
      <path d="M6.5 3.5h7.5l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 11h6M9 14h6M9 17h3" />
    </>
  ),
  report: (
    <>
      <path d="M5 4.5h10.5a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2Z" />
      <path d="M5 18a2 2 0 0 1 2-2h10.5M9 8.5h5" />
    </>
  ),
  file: <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />,
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  readonly name: IconName;
  readonly size?: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
