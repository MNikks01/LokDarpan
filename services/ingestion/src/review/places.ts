/**
 * Reviewing place names by place, not by page (ADR-077).
 *
 * A figure is checked against its own page, one at a time, because each figure
 * is its own claim. A place name is not: "Nagpur" on page 40 and "Nagpur" on
 * page 212 of the same report are the same claim, that this report uses the
 * word for the district. The extractor matches only names the state holds, so
 * what is left for a person to judge is whether the word means the place,
 * and that is judged by reading how each report uses it.
 *
 * So a reviewer is shown one place at a time, with one sentence from every
 * report that names it, and decides for all its pages together. Every page still
 * gets its own decision row, attributed to the reviewer and kept with its
 * history; a place that reads doubtfully anywhere is sent to the page-at-a-time
 * queue instead.
 */

export interface PlaceCandidateRow {
  readonly id: number;
  readonly documentId: number;
  readonly documentTitle: string;
  readonly pageNumber: number;
  readonly rawText: string;
  readonly value: string;
}

export interface PlaceGroup {
  readonly value: string;
  readonly factIds: readonly number[];
  readonly pages: number;
  /** One sentence per report, in the order the reports are held. */
  readonly examples: readonly {
    readonly documentTitle: string;
    readonly pageNumber: number;
    readonly rawText: string;
  }[];
}

/** Candidates grouped by the place they name, most-named first. */
export function groupByPlace(rows: readonly PlaceCandidateRow[]): PlaceGroup[] {
  const groups = new Map<string, PlaceCandidateRow[]>();
  for (const row of rows) {
    const list = groups.get(row.value) ?? [];
    list.push(row);
    groups.set(row.value, list);
  }
  return [...groups]
    .map(([value, list]) => {
      const byDocument = new Map<number, PlaceCandidateRow>();
      for (const row of list) {
        if (!byDocument.has(row.documentId)) byDocument.set(row.documentId, row);
      }
      return {
        value,
        factIds: list.map((r) => r.id),
        pages: list.length,
        examples: [...byDocument.values()]
          .sort((a, b) => a.documentId - b.documentId)
          .map((r) => ({
            documentTitle: r.documentTitle,
            pageNumber: r.pageNumber,
            rawText: r.rawText,
          })),
      };
    })
    .sort((a, b) => b.pages - a.pages || a.value.localeCompare(b.value));
}

/** The note every page's decision carries, so the history says how it was made. */
export function placeDecisionNote(group: PlaceGroup): string {
  const reports = group.examples.length;
  return (
    `Decided by place (ADR-077): ${group.value}, ${String(group.pages)} ` +
    `page${group.pages === 1 ? "" : "s"} in ${String(reports)} report${reports === 1 ? "" : "s"}, ` +
    `after reading one sentence from each report.`
  );
}
