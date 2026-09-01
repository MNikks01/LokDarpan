#!/bin/bash
#
# Sample each portal's landing window, hourly, for one day.
#
# Measures the decay curve that `tender-collection-cadence.md` needs: two
# points six hours apart showed near-total turnover, which is enough to know
# daily is wrong and not enough to know what is right.
#
# Install with `crontab -e`:
#   0 * * * * /Users/apple/Desktop/LokDarpan/services/ingestion/scripts/hourly-sample.sh
#
# IT STOPS ITSELF
# The sampler counts the passes already in its output and exits once twenty-four
# are recorded, so a cron entry left in place afterwards costs nothing. An
# experiment relying on someone remembering to switch it off is how a day of
# measurement becomes a year of unattended requests against public servers.
#
# NO DATABASE, NO CREDENTIALS
# This writes observations to a file and does not touch the ledger, so unlike
# the daily sweep it needs neither Postgres nor anything from .env.local.
# Instrumentation about our own coverage is not a record of what a government
# published, and it does not belong behind the ledger's provenance.

set -uo pipefail

REPO="/Users/apple/Desktop/LokDarpan"
LOG_DIR="${HOME}/Library/Logs/lokdarpan"
LOG="${LOG_DIR}/window-sample.log"
OUT="${LOG_DIR}/window-samples.jsonl"

mkdir -p "${LOG_DIR}"

say() {
    printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"${LOG}"
}

# Resolved rather than pinned: a hardcoded node version stops working at the
# next upgrade, and cron would report only "pnpm: command not found".
NODE_BIN="$(ls -d "${HOME}"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
if [ -z "${NODE_BIN}" ]; then
    say "ABORTED: no node installation found under ~/.nvm"
    exit 1
fi
export PATH="${NODE_BIN}:/usr/local/bin:/usr/bin:/bin"

cd "${REPO}/services/ingestion" || {
    say "ABORTED: cannot enter the ingestion package"
    exit 1
}

if pnpm ingest:gepnic-sample --out="${OUT}" --max-passes=24 >>"${LOG}" 2>&1; then
    say "pass complete"
else
    say "pass exited non-zero"
    exit 1
fi
