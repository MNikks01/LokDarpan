import { parseCorrection } from "@lokdarpan/domain";

import { submitCorrection } from "@/server/intake";
import { originLimited } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

/** A report is a few kilobytes of text; anything larger is not a report. */
const MAX_BODY_BYTES = 16_384;

const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * Only this site's own pages may post here. A browser always sends Origin on a
 * cross-site POST, so a form elsewhere cannot submit in a reader's name.
 */
function fromThisSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && new URL(origin).host === new URL(request.url).host;
}

/** The submitted fields, or `null` for a body that cannot be read. */
async function fieldsOf(
  request: Request,
  isForm: boolean,
): Promise<Record<string, unknown> | null> {
  try {
    return isForm
      ? Object.fromEntries((await request.formData()).entries())
      : ((await request.json()) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Answers in the form the request came in: a redirect for a form post (the
 * `/report` page needs no JavaScript), JSON otherwise.
 */
function responder(isForm: boolean): {
  ok: (reference: string | null) => Response;
  refuse: (
    status: number,
    code: string,
    problems?: readonly string[],
    subject?: string,
  ) => Response;
} {
  const redirect = (location: string): Response =>
    new Response(null, { status: 303, headers: { location, ...NO_STORE } });
  return {
    ok: (reference) =>
      isForm
        ? redirect(
            reference === null
              ? "/report/received"
              : `/report/received?ref=${encodeURIComponent(reference)}`,
          )
        : Response.json({ data: { reference } }, { status: 201, headers: NO_STORE }),
    refuse: (status, code, problems = [], subject) => {
      if (!isForm) {
        return Response.json({ error: { code, problems } }, { status, headers: NO_STORE });
      }
      const error = encodeURIComponent((problems.length > 0 ? problems : [code]).join(","));
      const keep = subject === undefined ? "" : `&subject=${encodeURIComponent(subject)}`;
      return redirect(`/report?error=${error}${keep}`);
    },
  };
}

/**
 * Receive a report of a data error (ADR-075). The site's only write path from
 * the public, and it writes a message to the reviewers, never a figure.
 */
export async function POST(request: Request): Promise<Response> {
  if (!fromThisSite(request)) {
    return Response.json({ error: { code: "FORBIDDEN" } }, { status: 403, headers: NO_STORE });
  }
  const isForm = !(request.headers.get("content-type") ?? "").includes("application/json");
  const { ok, refuse } = responder(isForm);

  if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
    return refuse(413, "TOO_LARGE");
  }
  if (await originLimited(request)) return refuse(429, "RATE_LIMITED");

  const fields = await fieldsOf(request, isForm);
  if (fields === null) return refuse(400, "BAD_REQUEST");

  const parsed = parseCorrection(fields);
  if (!parsed.ok) {
    // A script that filled the hidden field is told it succeeded and nothing is
    // stored: telling it why would teach it the field to skip.
    if (parsed.problems.includes("automated")) return ok(null);
    const subject = typeof fields["subject"] === "string" ? fields["subject"] : "";
    return refuse(400, "BAD_REQUEST", parsed.problems, subject);
  }

  const outcome = await submitCorrection(parsed.value);
  if (outcome.kind === "paused") return refuse(503, "PAUSED");
  if (outcome.kind === "unavailable") return refuse(503, "UNAVAILABLE");
  return ok(outcome.reference);
}
