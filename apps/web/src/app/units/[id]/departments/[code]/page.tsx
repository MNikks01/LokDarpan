import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Money } from "@lokdarpan/money";
import type { DepartmentFinanceView, DepartmentYearFinance } from "@lokdarpan/domain";

import { ApiError, getJson } from "@/lib/api";
import { ProvenanceNote } from "@/components/Provenance";
import { color, figureFontFeatures, radius, space } from "@/ui/tokens";

export const dynamic = "force-dynamic";

/**
 * A figure is rendered only through here, so an amount can never reach the page
 * without the server having decided whether it may be shown. `null` is not an
 * absence to skip over — it is a state with its own words.
 */
function Figure({
  inr,
  absent,
}: {
  readonly inr: string | null;
  readonly absent: string;
}): React.JSX.Element {
  if (inr === null) {
    return <span style={{ color: color.text.tertiary, fontSize: 13 }}>{absent}</span>;
  }
  const money = Money.fromDecimalString(inr);
  return (
    <span style={{ ...figureFontFeatures }} title={money.toAccessibleString()}>
      {money.format()}
    </span>
  );
}

/**
 * Two published figures for the same quantity differ by more than rounding.
 *
 * Compared as exact decimals rather than floats: these are government figures
 * in the hundreds of billions of paise, where a float comparison would start
 * inventing differences of its own.
 */
function conflicting(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  const paise = (v: string): bigint => {
    const [whole = "0", frac = ""] = v.split(".");
    return BigInt(whole + frac.padEnd(2, "0").slice(0, 2));
  };
  const diff = paise(a) - paise(b);
  return (diff < 0n ? -diff : diff) > 100n;
}

function YearRow({ year }: { readonly year: DepartmentYearFinance }): React.JSX.Element {
  const withheld = year.status === "not_published_for_period";
  const cell: React.CSSProperties = {
    padding: `${String(space[2])}px ${String(space[3])}px`,
    borderBottom: `1px solid ${color.border.hair}`,
    textAlign: "right",
    whiteSpace: "nowrap",
  };

  return (
    <tr>
      <th scope="row" style={{ ...cell, textAlign: "left", fontWeight: 500 }}>
        FY {year.fiscalYear}–{String(year.fiscalYear + 1).slice(2)}
      </th>
      <td style={cell}>
        <Figure inr={year.allocatedInr} absent="not published" />
        {conflicting(year.allocatedInr, year.allocatedInrAlternate) && (
          <>
            {" "}
            <abbr
              title="A second government report publishes a different figure for this year. See the note below the table."
              style={{ color: color.text.tertiary, textDecoration: "none", cursor: "help" }}
            >
              †
            </abbr>
          </>
        )}
      </td>
      <td style={cell}>
        <Figure inr={year.releasedInr} absent="not published" />
      </td>
      <td style={cell}>
        <Figure
          inr={year.utilizedInr}
          absent={withheld ? "not recorded for this year" : "not published"}
        />
      </td>
      <td style={cell}>
        <Figure inr={year.releaseVarianceInr} absent="—" />
      </td>
      <td style={cell}>
        <Figure inr={year.allocationVarianceInr} absent="—" />
      </td>
    </tr>
  );
}

async function load(id: string, code: string): Promise<DepartmentFinanceView | null> {
  try {
    const { data } = await getJson(
      `/api/v1/units/${encodeURIComponent(id)}/departments/${encodeURIComponent(code)}`,
    );
    return data as DepartmentFinanceView;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; code: string }>;
}): Promise<Metadata> {
  const { id, code } = await params;
  const view = await load(id, code);
  if (view === null) return { title: "Department not found" };
  const name = view.departmentNameEn ?? `Department ${view.departmentCode}`;
  return {
    title: `${name} — budget and expenditure · LokDarpan`,
    description: `Published budget, release and expenditure for ${name}, from the state treasury system.`,
  };
}

export default async function DepartmentPage({
  params,
}: {
  params: Promise<{ id: string; code: string }>;
}): Promise<React.JSX.Element> {
  const { id, code } = await params;
  const view = await load(id, code);
  if (view === null) notFound();

  const withheldYears = view.years.filter((y) => y.status === "not_published_for_period");
  const conflicts = view.years.filter((y) => conflicting(y.allocatedInr, y.allocatedInrAlternate));
  const head: React.CSSProperties = {
    padding: `${String(space[2])}px ${String(space[3])}px`,
    borderBottom: `2px solid ${color.border.strong}`,
    textAlign: "right",
    fontSize: 12,
    color: color.text.secondary,
    fontWeight: 600,
  };

  return (
    <>
      <nav aria-label="Breadcrumb" style={{ fontSize: 13, color: color.text.secondary }}>
        <a href="/units" style={{ color: color.text.secondary }}>
          India
        </a>{" "}
        ›{" "}
        <a href={`/units/${id}`} style={{ color: color.text.secondary }}>
          Maharashtra
        </a>{" "}
        › Department {view.departmentCode}
      </nav>

      <h1 style={{ fontSize: 26, margin: `${String(space[2])}px 0 ${String(space[1])}px` }}>
        {view.departmentNameEn ?? `Department ${view.departmentCode}`}
      </h1>

      {view.departmentNameEn === null && (
        // Not published and not collected are different claims. Saying which
        // one this is keeps the page from implying the state publishes nothing.
        <p style={{ color: color.text.secondary, fontSize: 13, marginTop: 0 }}>
          The treasury system publishes this department by code only. Its name is not part of the
          published data.
        </p>
      )}

      <section aria-labelledby="money" style={{ marginTop: space[5] }}>
        <h2 id="money" style={{ fontSize: 16, marginBottom: space[3] }}>
          Budget, release and expenditure
        </h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <caption
              style={{
                captionSide: "bottom",
                textAlign: "left",
                fontSize: 12,
                color: color.text.tertiary,
                paddingTop: space[3],
              }}
            >
              Release variance is released minus spent. Allocation variance is allocated minus
              spent. They answer different questions and are not interchangeable.
            </caption>
            <thead>
              <tr>
                <th scope="col" style={{ ...head, textAlign: "left" }}>
                  Financial year
                </th>
                <th scope="col" style={head}>
                  Allocated
                </th>
                <th scope="col" style={head}>
                  Released
                </th>
                <th scope="col" style={head}>
                  Spent
                </th>
                <th scope="col" style={head}>
                  Released − spent
                </th>
                <th scope="col" style={head}>
                  Allocated − spent
                </th>
              </tr>
            </thead>
            <tbody>
              {view.years.map((year) => (
                <YearRow key={year.fiscalYear} year={year} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {withheldYears.length > 0 && (
        <aside
          style={{
            marginTop: space[5],
            padding: space[4],
            borderRadius: radius.md,
            background: color.band.high.bg,
            color: color.band.high.fg,
            fontSize: 13,
          }}
        >
          <strong>Expenditure is not shown before FY {BEAMS_FIRST}.</strong> The treasury system
          records a zero against most schemes in those years rather than an amount, so the figures
          it publishes do not describe what was spent. Allocation and release are shown as
          published; expenditure and the two variances are withheld rather than presented as a
          comparison that would not be accurate.
        </aside>
      )}

      {conflicts.length > 0 && (
        // The brief's rule: do not silently choose one. Both figures are
        // published by the same government; the disagreement is a fact the
        // reader is entitled to, not a defect to hide behind one number.
        <aside
          style={{
            marginTop: space[5],
            padding: space[4],
            borderRadius: radius.md,
            background: color.band.high.bg,
            color: color.band.high.fg,
            fontSize: 13,
          }}
        >
          <strong>† Two government reports publish different allocation figures.</strong> For{" "}
          {conflicts.length === 1
            ? `FY ${String(conflicts[0]?.fiscalYear)}`
            : `${String(conflicts.length)} of these years`}
          , the departmental actuals report and the scheme-wise budget export do not agree. The
          figure shown is from the actuals report; the scheme-wise export gives{" "}
          {conflicts
            .slice(0, 3)
            .map((y) =>
              y.allocatedInrAlternate === null
                ? ""
                : `${Money.fromDecimalString(y.allocatedInrAlternate).format()} for FY ${String(y.fiscalYear)}`,
            )
            .filter((t) => t !== "")
            .join(", ")}
          . Released and spent agree exactly between the two reports; only the allocation differs,
          and which definition each uses has not been established. The{" "}
          <em>allocated minus spent</em> column inherits this uncertainty.
        </aside>
      )}

      <ProvenanceNote
        sourceUrl={view.provenance.sourceUrl}
        retrievedAt={view.provenance.retrievedAt}
        datasetVersion={view.datasetVersion}
      />
    </>
  );
}

const BEAMS_FIRST = 2021;
