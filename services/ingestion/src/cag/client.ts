import { sha256Of } from "../raw-store";

const USER_AGENT = "LokDarpan/0.1 (+https://github.com/MNikks01/LokDarpan)";
const BASE = "https://cag.gov.in";

/** Maharashtra's state id in the CAG audit-report filter, read from the page. */
export const MAHARASHTRA_STATE_ID = 79;

export interface FetchedDocument {
  readonly url: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly body: Buffer;
  readonly sha256: string;
}

export interface ReportLink {
  readonly url: string;
  readonly title: string;
}

export type HttpLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<Response>;

const REPORT_HREF = /href=["']([^"']*download_audit_report[^"']*)["']/giu;

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/gu, "&")
    .replace(/&#38;/gu, "&")
    .replace(/&quot;/gu, '"');
}

/**
 * Titles a report from its filename.
 *
 * CAG's listing markup does not reliably pair a link with its heading, and
 * guessing the pairing would attach the wrong title to a document that is then
 * cited as evidence. The filename is what the publisher chose and is stable, so
 * it is used verbatim rather than prettified into something that reads better
 * but is ours rather than theirs.
 */
export function titleFromUrl(url: string): string {
  const file = url.split("/").pop() ?? url;
  return file
    .replace(/-[0-9a-f]{10,}\.\d+\.pdf$/iu, "")
    .replace(/\.pdf$/iu, "")
    .replace(/[_-]+/gu, " ")
    .trim();
}

export class CagClient {
  constructor(
    private readonly baseUrl = BASE,
    private readonly http: HttpLike = fetch,
  ) {}

  private async request(url: string): Promise<FetchedDocument> {
    const response = await this.http(url, { headers: { "user-agent": USER_AGENT } });
    const body = Buffer.from(await response.arrayBuffer());
    return {
      url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      body,
      sha256: sha256Of(body),
    };
  }

  /** Report PDFs listed for one state. `cag.gov.in` serves no `robots.txt`. */
  async listStateReports(stateId = MAHARASHTRA_STATE_ID): Promise<ReportLink[]> {
    const url = `${this.baseUrl}/en/audit-report?gt=49&state%5B0%5D=${String(stateId)}`;
    const page = await this.request(url);
    if (page.status !== 200) {
      throw new Error(`CAG report listing returned HTTP ${String(page.status)}.`);
    }

    const html = page.body.toString("utf8");
    const seen = new Set<string>();
    const links: ReportLink[] = [];
    for (const match of html.matchAll(REPORT_HREF)) {
      const href = decodeEntities(match[1] ?? "");
      if (href === "" || seen.has(href)) continue;
      seen.add(href);
      links.push({
        url: href.startsWith("http") ? href : `${this.baseUrl}${href}`,
        title: titleFromUrl(href),
      });
    }

    if (links.length === 0) {
      throw new Error(
        "CAG listing contained no report links — refusing to report an empty discovery. " +
          "The page structure may have changed.",
      );
    }
    return links;
  }

  async fetchReport(url: string): Promise<FetchedDocument> {
    const doc = await this.request(url);
    if (doc.status !== 200) {
      throw new Error(`CAG report returned HTTP ${String(doc.status)} for ${url}.`);
    }
    // A report served as HTML is an error page, not a document. Storing it
    // would put a "not found" page into the evidence chain.
    const type = doc.contentType ?? "";
    if (!type.includes("pdf")) {
      throw new Error(`Expected a PDF from ${url} but the server sent "${type}".`);
    }
    return doc;
  }
}
