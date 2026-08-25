/**
 * A request path reduced to its route pattern, with identifiers removed.
 *
 * `.docs/13-observability/observability.md` §Explicitly never collected forbids
 * recording which entity a user viewed — only its type and level. A metric
 * labelled `/api/v1/units/20` would rebuild exactly the dataset that section
 * refuses to create: a record of who looked at what. `/api/v1/units/:id` answers
 * every operational question without it.
 *
 * The allowlist is deliberate. An unrecognised path becomes `other` rather than
 * being passed through, so a route added later cannot start leaking identifiers
 * into telemetry merely because nobody remembered this file.
 */
const PATTERNS: readonly { readonly test: RegExp; readonly pattern: string }[] = [
  { test: /^\/livez$/u, pattern: "/livez" },
  { test: /^\/readyz$/u, pattern: "/readyz" },
  { test: /^\/metrics$/u, pattern: "/metrics" },
  { test: /^\/api\/v1\/units$/u, pattern: "/api/v1/units" },
  { test: /^\/api\/v1\/units\/[^/]+$/u, pattern: "/api/v1/units/:id" },
  { test: /^\/api\/v1\/projects\/[^/]+$/u, pattern: "/api/v1/projects/:id" },
];

export function routePattern(path: string): string {
  const match = PATTERNS.find((p) => p.test.test(path));
  return match?.pattern ?? "other";
}
