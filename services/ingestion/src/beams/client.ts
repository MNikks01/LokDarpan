import { sha256Of } from "../raw-store";

const USER_AGENT = "LokDarpan/0.1 (+https://github.com/MNikks01/LokDarpan)";
const BASE = "https://beams.mahakosh.gov.in/Beams5/BudgetMVC/MISRPT";
const PARENT = `${BASE}/DepartmentExp1.jsp`;

export interface FetchedExport {
  readonly url: string;
  readonly status: number;
  readonly contentType: string | null;
  readonly body: Buffer;
  readonly sha256: string;
}

export type HttpLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<Response>;

/**
 * BEAMS returns an empty body — not an error — to a drill-down or export
 * request that arrives without a session cookie and a matching `Referer`.
 * That is easy to misread as "this department has no data", so the session is
 * established explicitly and an empty body is treated as a failure.
 */
export class BeamsClient {
  private cookie = "";

  constructor(
    private readonly baseUrl = BASE,
    private readonly http: HttpLike = fetch,
  ) {}

  private async request(url: string, referer?: string): Promise<FetchedExport> {
    const headers: Record<string, string> = { "user-agent": USER_AGENT };
    if (this.cookie !== "") headers["cookie"] = this.cookie;
    if (referer !== undefined) headers["referer"] = referer;

    const response = await this.http(url, { headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie !== null && setCookie !== "") {
      this.cookie = setCookie.split(";")[0] ?? "";
    }
    const body = Buffer.from(await response.arrayBuffer());
    return {
      url,
      status: response.status,
      contentType: response.headers.get("content-type"),
      body,
      sha256: sha256Of(body),
    };
  }

  async openSession(parent = "DepartmentExp1.jsp"): Promise<void> {
    const home = await this.request(`${this.baseUrl}/${parent}`);
    if (home.status !== 200) {
      throw new Error(`BEAMS parent report returned HTTP ${String(home.status)}.`);
    }
  }

  /**
   * Every department's actuals for one financial year, April to March.
   *
   * A different report from the scheme-wise export, in a different unit
   * ("Amount in Crores"), carrying figures the export does not have for
   * earlier years.
   */
  async fetchDepartmentActuals(year: number): Promise<FetchedExport> {
    const fy = `${String(year)}-${String(year + 1)}`;
    const url = `${this.baseUrl}/DeptExpAct1.jsp?fmonth=4&tmonth=3&year=${fy}&type=0`;
    const page = await this.request(url, `${this.baseUrl}/DeptExpAct.jsp`);
    if (page.status !== 200) {
      throw new Error(`BEAMS actuals report returned HTTP ${String(page.status)} for ${fy}.`);
    }
    if (page.body.byteLength === 0) {
      throw new Error(
        `BEAMS returned an empty body for the ${fy} actuals report. That usually means the ` +
          `session or request rate was rejected — it does not mean there is no data.`,
      );
    }
    return page;
  }

  /** One department's budget, release and expenditure for one financial year. */
  async fetchDepartmentYear(department: string, year: number): Promise<FetchedExport> {
    if (!/^[A-Z]{1,3}$/u.test(department)) {
      throw new Error(`"${department}" is not a BEAMS department code.`);
    }
    const url =
      `${this.baseUrl}/DepartmentExcelDownload_relasedFD.jsp` +
      `?year=${String(year)}&dept=${department}`;
    const page = await this.request(url, PARENT);

    if (page.status !== 200) {
      throw new Error(
        `BEAMS export returned HTTP ${String(page.status)} for ${department}/${String(year)}.`,
      );
    }
    if (page.body.byteLength === 0) {
      throw new Error(
        `BEAMS returned an empty body for ${department}/${String(year)}. ` +
          `That usually means the session or Referer was rejected — it does not mean there is no data.`,
      );
    }
    return page;
  }
}
