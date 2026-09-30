import type React from "react";
import Link from "next/link";
import type { LedgerOverview, StateHoldings } from "@lokdarpan/database/overview";
import type { IndiaOutline, StateCloseUp } from "@/server/india-map";
import { cx } from "@/ui/cx";
import { homeCopy, longDate, type Availability } from "@/copy/home";
import styles from "./home.module.css";
import { ABOUT_HREF, EXPLORE_HREF, HeroSchematic, ISSUE_HREF, StatusMark } from "./parts";
import { HeroMap, stateHref } from "./HeroMap";
import { PlacePreview, SourceTrail } from "./evidence";
import { CountUp } from "./CountUp";
import { Icon, type IconName } from "./icons";

/**
 * The homepage's sections, one component each.
 *
 * Every one takes the ledger overview or null. Null means the ledger could not
 * be read, and each section then says so in words where its numbers would be —
 * never a zero, never a number from an earlier build.
 */

type Overview = LedgerOverview | null;

/**
 * A status the ledger can contradict. A record kind marked available that the
 * ledger holds none of is shown as planned instead — the production ledger
 * held no audit reports until the reviewed corpus was promoted into it, and
 * the page must not claim otherwise. With no ledger to ask, the reviewed
 * default stands.
 */
function statusFor(fallback: Availability, held: number): Availability {
  return held > 0 ? fallback : "planned";
}

// ─── Hero ────────────────────────────────────────────────────────────────

export function HeroSection({
  outline,
  ov,
}: {
  readonly outline: IndiaOutline | null;
  readonly ov: Overview;
}): React.JSX.Element {
  const { hero } = homeCopy;
  return (
    <div className={styles.heroBand}>
      <div className={cx(styles.wrap, styles.hero)}>
        <section aria-labelledby="home-title" className={styles.fadeIn}>
          <p className={styles.eyebrow}>{hero.eyebrow}</p>
          <h1 id="home-title" className={styles.h1}>
            {hero.headline}
          </h1>
          <p className={styles.heroLead}>{hero.lead}</p>
          <div className={styles.ctas}>
            <Link href={EXPLORE_HREF} className={styles.primary}>
              {hero.primary} <Icon name="arrow" size={18} />
            </Link>
            <a href="#how-it-works" className={styles.secondary}>
              {hero.secondary}
            </a>
          </div>
          <p className={styles.micro}>{hero.micro}</p>
        </section>
        {outline === null ? (
          <HeroSchematic label={hero.schematicLabel} />
        ) : (
          <HeroMap
            outline={outline}
            holdings={ov === null ? null : ov.holdingsByState}
            tenderDistricts={ov === null ? null : ov.openTendersByDistrict}
          />
        )}
      </div>
    </div>
  );
}

// ─── What is held, counted ───────────────────────────────────────────────

interface StripItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly note: string;
}

function stripItems(ov: LedgerOverview): readonly StripItem[] {
  const { items } = homeCopy.strip;
  return [
    { key: "states", label: items.states, value: ov.states, note: items.statesNote },
    { key: "districts", label: items.districts, value: ov.districts, note: items.districtsNote },
    {
      key: "reports",
      label: items.reports,
      value: ov.reports,
      note: items.reportsNote(ov.reportPages),
    },
    { key: "figures", label: items.figures, value: ov.publishedFacts, note: items.figuresNote },
    {
      key: "tenders",
      label: items.tenders,
      value: ov.openTenders,
      note: items.tendersNote(ov.tenderPortals),
    },
  ];
}

export function HoldingsStrip({
  ov,
  datasetVersion,
  asOf,
}: {
  readonly ov: Overview;
  readonly datasetVersion: number | null;
  readonly asOf: string | null;
}): React.JSX.Element {
  const { strip } = homeCopy;
  const labels = [
    strip.items.states,
    strip.items.districts,
    strip.items.reports,
    strip.items.figures,
    strip.items.tenders,
  ];
  return (
    <section className={styles.strip} aria-labelledby="home-strip">
      <div className={styles.wrap}>
        <h2 id="home-strip" className={styles.stripHeading}>
          {strip.heading}
        </h2>
        <dl className={styles.stripGrid}>
          {ov === null
            ? labels.map((label) => (
                <div key={label} className={styles.stripItem}>
                  <dt>{label}</dt>
                  <dd className={styles.stripValue}>
                    <span className={styles.notRead}>{strip.notRead}</span>
                  </dd>
                </div>
              ))
            : stripItems(ov).map((item) => (
                <div key={item.key} className={styles.stripItem}>
                  <dt>{item.label}</dt>
                  <dd className={styles.stripValue}>
                    <CountUp value={item.value} />
                  </dd>
                  <dd className={styles.stripNote}>{item.note}</dd>
                </div>
              ))}
        </dl>
        <p className={styles.stripFoot}>
          {ov === null || datasetVersion === null
            ? strip.unavailable
            : strip.asOf(longDate(asOf ?? new Date().toISOString()), datasetVersion)}
        </p>
      </div>
    </section>
  );
}

// ─── One place, many records ─────────────────────────────────────────────

const FLOW_ICONS: Readonly<Record<string, IconName>> = {
  place: "place",
  audit: "audit",
  tender: "tender",
  work: "work",
  contractor: "contractor",
  expenditure: "expenditure",
};

function flowStatus(key: string, fallback: Availability, ov: Overview): Availability {
  if (ov === null) return fallback;
  if (key === "place") return statusFor(fallback, ov.districts);
  if (key === "audit") return statusFor(fallback, ov.reports);
  if (key === "tender") return statusFor(fallback, ov.tenderPortals);
  return fallback;
}

export function FlowSection({ ov }: { readonly ov: Overview }): React.JSX.Element {
  const { flow } = homeCopy;
  return (
    <section
      id="how-it-works"
      className={cx(styles.section, styles.reveal)}
      aria-labelledby="home-flow"
    >
      <div className={styles.wrap}>
        <p className={styles.eyebrow}>{flow.eyebrow}</p>
        <h2 id="home-flow" className={styles.h2}>
          {flow.heading}
        </h2>
        <p className={styles.lead}>{flow.body}</p>
        <ol className={styles.flow}>
          {flow.steps.map((step) => {
            const status = flowStatus(step.key, step.status, ov);
            return (
              <li key={step.key} className={styles.flowStep} data-status={status}>
                <span className={styles.flowIcon}>
                  <Icon name={FLOW_ICONS[step.key] ?? "place"} size={22} />
                </span>
                <h3 className={styles.flowLabel}>{step.label}</h3>
                <p className={styles.flowBody}>{step.body}</p>
                <StatusMark status={status} />
              </li>
            );
          })}
        </ol>
        <p className={styles.note}>{flow.note}</p>
      </div>
    </section>
  );
}

// ─── The explorer, previewed ─────────────────────────────────────────────

function PreviewBody({
  ov,
  state,
  closeUp,
}: {
  readonly ov: LedgerOverview;
  readonly state: StateHoldings;
  readonly closeUp: StateCloseUp;
}): React.JSX.Element {
  const tenders = ov.openTendersByDistrict.filter((d) => d.stateLgdCode === state.stateLgdCode);
  // A state whose portal is not collected gets no count at all, never a zero.
  const openTenders = ov.tenderStates.includes(state.stateLgdCode)
    ? tenders.reduce((sum, d) => sum + d.openTenders, 0)
    : null;
  return (
    <figure className={styles.previewFigure}>
      <PlacePreview
        closeUp={closeUp}
        reports={state.reports}
        figures={state.publishedFacts}
        openTenders={openTenders}
        tenderDistricts={new Set(tenders.map((d) => d.districtLgdCode))}
      />
      <figcaption className={styles.note}>{homeCopy.preview.caption}</figcaption>
    </figure>
  );
}

export function PreviewSection({
  ov,
  state,
  closeUp,
}: {
  readonly ov: Overview;
  /** The first state, in LGD-code order, that holds reports. */
  readonly state: StateHoldings | null;
  readonly closeUp: StateCloseUp | null;
}): React.JSX.Element {
  const { preview } = homeCopy;
  return (
    <section className={cx(styles.section, styles.sectionTinted)} aria-labelledby="home-preview">
      <div className={cx(styles.wrap, styles.reveal)}>
        <p className={styles.eyebrow}>{preview.eyebrow}</p>
        <h2 id="home-preview" className={styles.h2}>
          {preview.heading}
        </h2>
        <p className={styles.lead}>{preview.body}</p>
        {ov === null || closeUp === null || state === null ? (
          <p className={styles.unavailableBox}>{preview.unavailable}</p>
        ) : (
          <PreviewBody ov={ov} state={state} closeUp={closeUp} />
        )}
      </div>
    </section>
  );
}

// ─── Every figure has a source ───────────────────────────────────────────

export function TrailSection({ ov }: { readonly ov: Overview }): React.JSX.Element {
  const { trail } = homeCopy;
  const example = ov === null ? null : ov.example;
  let note: string | null = trail.exampleNote;
  if (ov === null) note = trail.unavailable;
  else if (example === null) note = null;
  return (
    <section className={styles.section} aria-labelledby="home-trail">
      <div className={cx(styles.wrap, styles.twoCol, styles.reveal)}>
        <div>
          <p className={styles.eyebrow}>{trail.eyebrow}</p>
          <h2 id="home-trail" className={styles.h2}>
            {trail.heading}
          </h2>
          <p className={styles.lead}>{trail.body}</p>
          {note === null ? null : <p className={styles.note}>{note}</p>}
        </div>
        <div className={styles.trailBox}>
          <h3 className={styles.chainTitle}>{trail.exampleLabel}</h3>
          <SourceTrail example={example} />
        </div>
      </div>
    </section>
  );
}

// ─── Availability ────────────────────────────────────────────────────────

interface MatrixRow {
  readonly key: string;
  readonly record: string;
  readonly status: Availability;
  readonly held: string;
  readonly source: string;
}

interface RowCopy {
  readonly record: string;
  readonly source: string;
}

/** A counted row: its status and what it holds follow the ledger. */
function counted(
  row: RowCopy & { readonly key: string; readonly fallback: Availability },
  count: number,
  describe: () => string,
): MatrixRow {
  return {
    key: row.key,
    record: row.record,
    source: row.source,
    status: statusFor(row.fallback, count),
    held: count > 0 ? describe() : homeCopy.matrix.notHeld,
  };
}

/** A row the ledger was not asked about, because it could not be read. */
function unread(key: string, row: RowCopy, status: Availability): MatrixRow {
  return { key, record: row.record, source: row.source, status, held: homeCopy.matrix.notRead };
}

function plannedRows(): readonly MatrixRow[] {
  const { rows, notHeld } = homeCopy.matrix;
  return [
    { key: "budgets", ...rows.budgets, status: "planned", held: rows.budgets.held },
    { key: "works", ...rows.works, status: "planned", held: notHeld },
    { key: "contractors", ...rows.contractors, status: "planned", held: notHeld },
  ];
}

function matrixRows(ov: Overview): readonly MatrixRow[] {
  const { rows } = homeCopy.matrix;
  if (ov === null) {
    return [
      unread("boundaries", rows.boundaries, "available"),
      unread("local", rows.local, "partial"),
      unread("reports", rows.reports, "available"),
      unread("figures", rows.figures, "available"),
      unread("tenders", rows.tenders, "partial"),
      ...plannedRows(),
    ];
  }
  return [
    counted({ key: "boundaries", ...rows.boundaries, fallback: "available" }, ov.districts, () =>
      rows.boundaries.held(ov.states, ov.districts),
    ),
    counted({ key: "local", ...rows.local, fallback: "partial" }, ov.belowDistrict, () =>
      rows.local.held(ov.belowDistrict),
    ),
    counted({ key: "reports", ...rows.reports, fallback: "available" }, ov.reports, () =>
      rows.reports.held(ov.reports, ov.reportPages),
    ),
    counted({ key: "figures", ...rows.figures, fallback: "available" }, ov.publishedFacts, () =>
      rows.figures.held(ov.publishedFacts),
    ),
    counted({ key: "tenders", ...rows.tenders, fallback: "partial" }, ov.tenderPortals, () =>
      rows.tenders.held(ov.openTenders, ov.tenderPortals),
    ),
    ...plannedRows(),
  ];
}

export function MatrixSection({ ov }: { readonly ov: Overview }): React.JSX.Element {
  const { matrix } = homeCopy;
  return (
    <section className={styles.section} aria-labelledby="home-matrix">
      <div className={cx(styles.wrap, styles.reveal)}>
        <p className={styles.eyebrow}>{matrix.eyebrow}</p>
        <h2 id="home-matrix" className={styles.h2}>
          {matrix.heading}
        </h2>
        <p className={styles.lead}>{matrix.body}</p>
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th scope="col">{matrix.columns.record}</th>
              <th scope="col">{matrix.columns.status}</th>
              <th scope="col">{matrix.columns.held}</th>
              <th scope="col">{matrix.columns.source}</th>
            </tr>
          </thead>
          <tbody>
            {matrixRows(ov).map((row) => (
              <tr key={row.key} data-status={row.status}>
                <th scope="row">{row.record}</th>
                <td>
                  <StatusMark status={row.status} />
                </td>
                <td data-label={matrix.columns.held}>{row.held}</td>
                <td data-label={matrix.columns.source}>{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Explore by place ────────────────────────────────────────────────────

const LEVEL_ICONS: readonly IconName[] = ["state", "district", "local"];

function StateMarkers({
  reports,
  tenders,
}: {
  readonly reports: boolean;
  readonly tenders: boolean;
}): React.JSX.Element {
  return (
    <span className={styles.markers} aria-hidden="true">
      {reports ? <span className={cx(styles.marker, styles.markerReports)} /> : null}
      {tenders ? <span className={cx(styles.marker, styles.markerTenders)} /> : null}
    </span>
  );
}

function StateList({
  ov,
  outline,
}: {
  readonly ov: Overview;
  readonly outline: IndiaOutline;
}): React.JSX.Element {
  const { places } = homeCopy;
  const states = [...outline.states].sort((a, b) => a.name.localeCompare(b.name));
  const reportStates = new Set(ov === null ? [] : ov.holdingsByState.map((s) => s.stateLgdCode));
  const tenderStates = new Set(ov === null ? [] : ov.tenderStates);
  return (
    <>
      <div className={styles.statesHead}>
        <h3 className={styles.chainTitle}>{places.statesHeading}</h3>
        {ov === null ? null : (
          <ul className={styles.legend}>
            <li>
              <StateMarkers reports tenders={false} />
              {places.legendReports}
            </li>
            <li>
              <StateMarkers reports={false} tenders />
              {places.legendTenders}
            </li>
          </ul>
        )}
      </div>
      <ul className={styles.stateGrid}>
        {states.map((state) => (
          <li key={state.code}>
            <Link
              href={stateHref(state.code)}
              className={styles.stateLink}
              aria-label={places.stateLink(state.name)}
            >
              <span>{state.name}</span>
              <StateMarkers
                reports={reportStates.has(state.code)}
                tenders={tenderStates.has(state.code)}
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PlacesSection({
  ov,
  outline,
}: {
  readonly ov: Overview;
  readonly outline: IndiaOutline | null;
}): React.JSX.Element {
  const { places } = homeCopy;
  return (
    <section className={cx(styles.section, styles.sectionTinted)} aria-labelledby="home-places">
      <div className={cx(styles.wrap, styles.reveal)}>
        <p className={styles.eyebrow}>{places.eyebrow}</p>
        <h2 id="home-places" className={styles.h2}>
          {places.heading}
        </h2>
        <p className={styles.lead}>{places.body}</p>
        <ol className={styles.levels}>
          {places.levels.map((level, index) => {
            // Below district the ledger may hold nothing — production held none
            // on 29 September 2026 — and the level then says so.
            const none = index === 2 && ov !== null && ov.belowDistrict === 0;
            const status = none ? "planned" : level.status;
            return (
              <li key={level.label} className={styles.level}>
                <span className={styles.flowIcon}>
                  <Icon name={LEVEL_ICONS[index] ?? "place"} size={22} />
                </span>
                <div>
                  <h3 className={styles.flowLabel}>{level.label}</h3>
                  <p className={styles.flowBody}>{none ? places.localNone : level.body}</p>
                </div>
                <StatusMark status={status} />
              </li>
            );
          })}
        </ol>
        {outline === null ? null : <StateList ov={ov} outline={outline} />}
      </div>
    </section>
  );
}

// ─── Audience ────────────────────────────────────────────────────────────

const AUDIENCE_ICONS: Readonly<Record<string, IconName>> = {
  citizens: "citizens",
  journalists: "journalists",
  researchers: "researchers",
  developers: "developers",
  civil: "civil",
};

export function AudienceSection(): React.JSX.Element {
  const { audience } = homeCopy;
  return (
    <section className={styles.section} aria-labelledby="home-audience">
      <div className={cx(styles.wrap, styles.reveal)}>
        <p className={styles.eyebrow}>{audience.eyebrow}</p>
        <h2 id="home-audience" className={styles.h2}>
          {audience.heading}
        </h2>
        <ul className={styles.grid5}>
          {audience.groups.map((group) => (
            <li key={group.key} className={styles.card}>
              <span className={styles.flowIcon}>
                <Icon name={AUDIENCE_ICONS[group.key] ?? "citizens"} size={22} />
              </span>
              <h3 className={styles.cardTitle}>{group.title}</h3>
              <p className={styles.cardBody}>{group.body}</p>
              <p className={styles.example}>{group.example}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ─── Limitations ─────────────────────────────────────────────────────────

export function LimitsSection(): React.JSX.Element {
  const { limits } = homeCopy;
  return (
    <section className={cx(styles.section, styles.sectionTinted)} aria-labelledby="home-limits">
      <div className={cx(styles.wrap, styles.twoCol, styles.reveal)}>
        <div>
          <p className={styles.eyebrow}>{limits.eyebrow}</p>
          <h2 id="home-limits" className={styles.h2}>
            {limits.heading}
          </h2>
          <p className={styles.lead}>{limits.body}</p>
          <ul className={styles.limitList}>
            {limits.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
        <div className={styles.notBox}>
          <h3>{limits.notHeading}</h3>
          <p>{limits.not}</p>
          <a href={ISSUE_HREF} rel="noopener noreferrer" className={styles.textLink}>
            {limits.reportIssue} <Icon name="arrow" size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Current coverage ────────────────────────────────────────────────────

function CoverageBody({ ov }: { readonly ov: LedgerOverview }): React.JSX.Element {
  const { coverage } = homeCopy;
  const states = ov.holdingsByState;
  return (
    <>
      <p className={styles.lead}>{states.length === 0 ? coverage.none : coverage.body}</p>
      {states.length === 0 ? null : (
        <ul className={styles.coverageGrid}>
          {states.map((state) => (
            <li key={state.stateLgdCode} className={styles.coverageCard}>
              <Link href={stateHref(state.stateLgdCode)} className={styles.coverageName}>
                {state.stateName} <Icon name="arrow" size={16} />
              </Link>
              <dl>
                <div>
                  <dt>{coverage.columns.reports}</dt>
                  <dd>
                    <CountUp value={state.reports} />
                  </dd>
                </div>
                <div>
                  <dt>{coverage.columns.figures}</dt>
                  <dd>
                    <CountUp value={state.publishedFacts} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.note}>
        {coverage.tenders(ov.tenderPortals, ov.tenderStates.length)}
        {ov.tenderStates.includes("27") ? null : ` ${coverage.maharashtraTenders}`}
      </p>
      <p className={styles.note}>{coverage.next}</p>
    </>
  );
}

export function CoverageSection({ ov }: { readonly ov: Overview }): React.JSX.Element {
  const { coverage } = homeCopy;
  return (
    <section className={styles.section} aria-labelledby="home-coverage">
      <div className={cx(styles.wrap, styles.reveal)}>
        <p className={styles.eyebrow}>{coverage.eyebrow}</p>
        <h2 id="home-coverage" className={styles.h2}>
          {coverage.heading}
        </h2>
        {ov === null ? (
          <p className={styles.unavailableBox}>{coverage.unavailable}</p>
        ) : (
          <CoverageBody ov={ov} />
        )}
      </div>
    </section>
  );
}

// ─── Closing ─────────────────────────────────────────────────────────────

export function FinalSection(): React.JSX.Element {
  const { final } = homeCopy;
  return (
    <section className={styles.final} aria-labelledby="home-final">
      <div className={cx(styles.wrap, styles.reveal)}>
        <h2 id="home-final" className={styles.h2}>
          {final.heading}
        </h2>
        <p className={styles.lead}>{final.body}</p>
        <div className={styles.ctas}>
          <Link href={EXPLORE_HREF} className={styles.primary}>
            {final.primary} <Icon name="arrow" size={18} />
          </Link>
          <Link href={ABOUT_HREF} className={styles.secondary}>
            {final.secondary}
          </Link>
        </div>
      </div>
    </section>
  );
}
