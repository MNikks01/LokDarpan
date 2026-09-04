#!/usr/bin/env bash
#
# Fails the build on a known advisory. Does not fail it when nobody could be
# asked.
#
# `pnpm audit` exits 1 for both, and they are not the same fact: one is about
# this repository, the other is about npm's advisory service being reachable
# from a CI runner. Conflating them means a third-party outage blocks every
# merge, and a gate that blocks merges for reasons nobody can act on is a gate
# people learn to bypass with `--admin` — which disables all six required
# checks, not the one that is stuck. That failure mode is on the record in
# `.docs/adr/016-review-requirement.md`.
#
# THE DISCRIMINATOR
# `pnpm audit --json` prints JSON in both cases, so "did it parse" decides
# nothing. When the request fails it prints an object whose only key is
# `error`:
#
#     {"error":{"code":"ERR_SOCKET_TIMEOUT","message":"request to … failed"}}
#
# A report without that key is an answer, and whatever it says is binding.

set -uo pipefail

LEVEL="${1:-high}"
ATTEMPTS="${AUDIT_ATTEMPTS:-3}"
DELAY="${AUDIT_RETRY_DELAY:-20}"

for attempt in $(seq 1 "$ATTEMPTS"); do
  report="$(pnpm audit --audit-level "$LEVEL" --json 2>/dev/null)"
  status=$?

  if printf '%s' "$report" | jq -e 'type == "object" and (has("error") | not)' >/dev/null 2>&1; then
    if [ "$status" -eq 0 ]; then
      echo "No advisories at severity '$LEVEL' or above."
      exit 0
    fi

    echo "::error::Dependencies carry advisories at severity '$LEVEL' or above."
    printf '%s' "$report" |
      jq -r '.advisories // {} | to_entries[] | .value |
             "  \(.severity)\t\(.module_name)\t\(.title)\n    \(.url)"' || true
    exit 1
  fi

  echo "attempt ${attempt}/${ATTEMPTS}: the advisory service did not answer."
  printf '%s' "$report" | jq -r '.error | "    \(.code): \(.message)"' 2>/dev/null ||
    echo "    (no parseable response)"
  if [ "$attempt" -lt "$ATTEMPTS" ]; then sleep "$DELAY"; fi
done

# Deliberately exit 0. Read the warning as "this check did not run", never as
# "these dependencies are clean" — nothing here established that.
echo "::warning::npm's advisory service was unreachable after ${ATTEMPTS} attempts, \
so dependencies were NOT audited. This is not a clean result; it is an absent one. \
Re-run this job once the service recovers."
{
  echo "### Dependency audit did not run"
  echo
  echo "npm's advisory service (\`/-/npm/v1/security/audits\`) did not respond after \
${ATTEMPTS} attempts. The build was not failed, because an unreachable third party is \
not a finding about this repository — but **nothing was verified**. Re-run this job \
when the service recovers."
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
exit 0
