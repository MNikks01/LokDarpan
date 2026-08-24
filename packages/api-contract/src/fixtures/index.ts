/**
 * ⚠ FIXTURE DATA — NOT A GOVERNMENT SOURCE.
 *
 * Used only for development and tests until the backend exists (.docs/28
 * §Backend dependencies). Every figure here is synthetic. A build-time test
 * asserts this directory is absent from the production bundle.
 */
import projectRaw from "./project-501.json" with { type: "json" };
export const FIXTURE_PROJECT_501 = projectRaw;
export const FIXTURE_WARNING = "FIXTURE — not a government source" as const;
