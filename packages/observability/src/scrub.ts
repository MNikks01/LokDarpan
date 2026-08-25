/**
 * Scrubs credentials out of free-text log values.
 *
 * Redacting by key name — `password`, `token` — only protects values a caller
 * deliberately placed under a known key. It does nothing for the common case:
 * an error message that happens to contain a connection string, because the
 * driver put it there.
 *
 *   connect ECONNREFUSED postgresql://user:s3cr3t@db.internal:5432/lokdarpan
 *
 * That line is written by an exception handler, not by anyone choosing to log a
 * secret, and it would be shipped verbatim to an aggregator. Observability must
 * not become an exfiltration path (.docs/13-observability/observability.md).
 */

/** `scheme://user:password@host` — the password, never the user or the host. */
const URL_CREDENTIALS = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/@]+):[^\s@]+@/giu;

/**
 * `Authorization: Bearer …` and friends.
 *
 * Applied before {@link INLINE_SECRET}, which would otherwise match
 * `authorization:` and capture the word `Bearer` as the value, leaving the
 * token itself in the line.
 */
const BEARER = /\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/giu;

/**
 * `password=…`, `token: …`, `AWS_ACCESS_KEY=…` inside otherwise-free text.
 *
 * The optional prefix matters: `AWS_ACCESS_KEY` has no word boundary between
 * `AWS_` and `ACCESS`, because `_` is a word character. Without it the most
 * common shape of a leaked credential — an environment-variable name — passes
 * straight through.
 */
const INLINE_SECRET =
  /\b((?:[A-Za-z0-9]+[_-])*(?:password|passwd|pwd|token|secret|api[_-]?key|access[_-]?key|authorization|auth))\s*[=:]\s*("[^"]*"|'[^']*'|[^\s,;)&]+)/giu;

/**
 * A connection string with no password still names an internal host and user.
 * Those are not secrets, and keeping them is what makes the log useful for
 * diagnosis, so they are deliberately left alone.
 */
export function scrubSecrets(value: string): string {
  return value
    .replace(URL_CREDENTIALS, "$1:[redacted]@")
    .replace(BEARER, "$1 [redacted]")
    .replace(INLINE_SECRET, "$1=[redacted]");
}

/** Applies {@link scrubSecrets} to strings and leaves other values untouched. */
export function scrubValue<T>(value: T): T | string {
  return typeof value === "string" ? scrubSecrets(value) : value;
}
