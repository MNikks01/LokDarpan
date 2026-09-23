import type { FetchLimits } from "./fetch-with-limits";

/**
 * How large and how slow each source may be.
 *
 * HOW THE NUMBERS WERE CHOSEN
 * A byte limit is four times the largest artefact of that kind in the raw store,
 * rounded up to a power of two. Four times, because a limit set at today's
 * maximum fails on the first report that is slightly longer, and a limit set with
 * no reference to what the source actually serves defends against nothing. Where
 * nothing has been measured, the limit is a generous ceiling and says so; the
 * failure message names the limit, so a legitimate response that reaches it is
 * a visible, one-line change here rather than a silent loss.
 *
 * Measured on 2026-09-17 from `data/raw`:
 *   cag    30 artefacts, largest 28.8 MB (a report PDF)
 *   beams  18 artefacts, largest 1.0 MB
 *   lgd     4 artefacts, largest 135 KB
 * GePNIC pages and Overpass responses are not kept in the raw store and were
 * not measured.
 *
 * Timeouts: government hosts are slow rather than silent, so headers get 30 s
 * and a body may pause 60 s between chunks. The total is what separates a large
 * download on a poor link from a stalled one.
 */

const KIB = 1024;
const MIB = 1024 * KIB;
const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Headers and chunk silence for any government web server. */
const PATIENT = { headersTimeoutMs: 30 * SECOND, idleTimeoutMs: 60 * SECOND } as const;

/** CAG report PDFs: largest measured 28.8 MB → 4× → 128 MiB. */
export const CAG_REPORT: FetchLimits = {
  maxBytes: 128 * MIB,
  ...PATIENT,
  totalTimeoutMs: 15 * MINUTE,
};

/**
 * CAG listing pages. Not measured apart from the PDFs they list; a listing is
 * HTML for one state's reports, and a ceiling far above that costs nothing.
 */
export const CAG_PAGE: FetchLimits = {
  maxBytes: 16 * MIB,
  ...PATIENT,
  totalTimeoutMs: 2 * MINUTE,
};

/** LGD citizen views: largest measured 135 KB → 4× → 1 MiB. */
export const LGD_PAGE: FetchLimits = {
  maxBytes: 1 * MIB,
  ...PATIENT,
  totalTimeoutMs: 2 * MINUTE,
};

/** BEAMS exports and reports: largest measured 1.0 MB → 4× → 4 MiB. */
export const BEAMS_EXPORT: FetchLimits = {
  maxBytes: 4 * MIB,
  ...PATIENT,
  totalTimeoutMs: 5 * MINUTE,
};

/**
 * robots.txt. 500 KiB is the size beyond which Google stops reading a robots
 * file, so a larger one is not a policy any crawler honours in full.
 */
export const ROBOTS_TXT: FetchLimits = {
  maxBytes: 500 * KIB,
  ...PATIENT,
  totalTimeoutMs: 1 * MINUTE,
};

/** GePNIC portal pages. Unmeasured: a generous ceiling for HTML. */
export const GEPNIC_PAGE: FetchLimits = {
  maxBytes: 16 * MIB,
  ...PATIENT,
  totalTimeoutMs: 2 * MINUTE,
};

/**
 * Overpass query results. Unmeasured, and a district's boundaries with full
 * geometry are legitimately large, so the ceiling is generous.
 *
 * The headers wait is the longest here on purpose. Overpass computes the whole
 * answer before it sends a byte, and our queries allow the server 240 seconds
 * (`[timeout:240]`), so headers may take that long plus connection set-up.
 */
export const OVERPASS_QUERY: FetchLimits = {
  maxBytes: 256 * MIB,
  headersTimeoutMs: 270 * SECOND,
  idleTimeoutMs: 60 * SECOND,
  totalTimeoutMs: 10 * MINUTE,
};

/** Overpass `/api/status`: a few lines of text. */
export const OVERPASS_STATUS: FetchLimits = {
  maxBytes: 64 * KIB,
  headersTimeoutMs: 30 * SECOND,
  idleTimeoutMs: 30 * SECOND,
  totalTimeoutMs: 1 * MINUTE,
};
