import { sha256Of } from "../raw-store.js";

/**
 * LGD issues a CSRF token per session and requires it on the citizen views.
 * Every request identifies itself; collection is scheduled and cached, never
 * triggered by a user request (CONTRIBUTING.md §Collecting from a source).
 */
const USER_AGENT = "LokDarpan/0.1 (+https://github.com/MNikks01/LokDarpan)";

export interface FetchedPage {
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

const CSRF_TOKEN = /OWASP_CSRFTOKEN=([A-Z0-9-]+)/u;

export class LgdClient {
  private cookie = "";
  private token: string | null = null;

  constructor(
    private readonly baseUrl = "https://lgdirectory.gov.in",
    private readonly http: HttpLike = fetch,
  ) {}

  private async request(path: string): Promise<FetchedPage> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { "user-agent": USER_AGENT };
    if (this.cookie !== "") headers["cookie"] = this.cookie;

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

  /** Establishes a session and captures the CSRF token the citizen views require. */
  async openSession(): Promise<void> {
    const home = await this.request("/");
    if (home.status !== 200) {
      throw new Error(`LGD home returned HTTP ${String(home.status)}; cannot establish a session.`);
    }
    const match = CSRF_TOKEN.exec(home.body.toString("utf8"));
    if (match === null) {
      throw new Error(
        "No CSRF token found on the LGD home page. The site structure has changed; " +
          "guessing a token would be wrong.",
      );
    }
    this.token = match[1] ?? null;
  }

  async fetchStates(): Promise<FetchedPage> {
    if (this.token === null) {
      throw new Error("openSession() must be called before fetching a citizen view.");
    }
    const page = await this.request(`/globalviewstateforcitizen.do?OWASP_CSRFTOKEN=${this.token}`);
    if (page.status !== 200) {
      throw new Error(`LGD state listing returned HTTP ${String(page.status)}.`);
    }
    return page;
  }
}
