import type React from "react";
import type { Metadata } from "next";

import { CORRECTION_CATEGORIES, HONEYPOT_FIELD, isCorrectionSubject } from "@lokdarpan/domain";

import { reportCopy as copy } from "@/copy/report";
import { color, radius, space } from "@/ui/tokens";

export const metadata: Metadata = {
  title: `${copy.title} — LokDarpan`,
  description: copy.intro,
  robots: { index: false },
};

export const dynamic = "force-dynamic";

const field: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: space[2],
  borderRadius: radius.md,
  border: `1px solid ${color.border.hair}`,
  font: "inherit",
};
const label: React.CSSProperties = { display: "block", marginTop: space[5], fontWeight: 600 };
const hint: React.CSSProperties = { fontSize: 13, color: color.text.secondary, margin: "4px 0 0" };

/** Every problem the route named, as the reader should read it. */
function problemsFrom(error: string | undefined): readonly string[] {
  if (error === undefined || error === "") return [];
  const problems: Readonly<Record<string, string>> = copy.problems;
  return error
    .split(",")
    .map((code) => problems[code] ?? copy.failures[code])
    .filter((m): m is string => m !== undefined);
}

/**
 * The correction form (ADR-075). A plain HTML form that posts to
 * `/api/v1/corrections` and needs no JavaScript: a reader on a slow phone, or
 * with scripts off, can report an error as easily as anyone.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; error?: string }>;
}): Promise<React.JSX.Element> {
  const { subject: given, error } = await searchParams;
  const subject = given !== undefined && isCorrectionSubject(given) ? given : "page:/";
  const problems = problemsFrom(error);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: space[7] }}>
      <h1 style={{ fontSize: 26 }}>{copy.title}</h1>
      <p style={{ color: color.text.secondary }}>{copy.intro}</p>
      <p style={{ color: color.text.secondary, fontSize: 14 }}>{copy.noAccount}</p>

      {problems.length > 0 && (
        <ul
          role="alert"
          style={{
            padding: space[4],
            paddingInlineStart: space[7],
            borderRadius: radius.md,
            border: `1px solid ${color.border.hair}`,
          }}
        >
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <form method="post" action="/api/v1/corrections">
        <input type="hidden" name="subject" value={subject} />
        <p style={{ ...hint, marginTop: space[4] }}>
          {copy.aboutLabel}:{" "}
          {subject.startsWith("page:") ? copy.aboutPage : copy.aboutRecord(subject)}
        </p>

        <label style={label} htmlFor="category">
          {copy.categoryLabel}
        </label>
        <select id="category" name="category" required style={field} defaultValue="">
          <option value="" disabled />
          {CORRECTION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {copy.categories[c]}
            </option>
          ))}
        </select>

        <label style={label} htmlFor="description">
          {copy.descriptionLabel}
        </label>
        <p style={hint}>{copy.descriptionHint}</p>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          style={field}
        />

        <label style={label} htmlFor="evidenceUrl">
          {copy.evidenceLabel}
        </label>
        <p style={hint}>{copy.evidenceHint}</p>
        <input id="evidenceUrl" name="evidenceUrl" type="url" maxLength={1000} style={field} />

        {/* Hidden from people and from assistive technology; only scripts fill it. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-10000px" }}>
          <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" />
        </div>

        <button
          type="submit"
          style={{
            marginTop: space[6],
            padding: `${String(space[2])}px ${String(space[5])}px`,
            borderRadius: radius.md,
            border: `1px solid ${color.border.hair}`,
            background: color.accent.base,
            color: color.bg.surface,
            font: "inherit",
            fontWeight: 600,
          }}
        >
          {copy.submit}
        </button>
      </form>
    </main>
  );
}
