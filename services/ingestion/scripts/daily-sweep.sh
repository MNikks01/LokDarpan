#!/bin/bash
#
# Collect every permitting GePNIC portal, once a day.
#
# Written to be run by cron, which is a hostile environment for scripts that
# assume a shell: no profile is read, PATH is minimal, and the working
# directory is not where you expect. Everything below is explicit for that
# reason rather than out of caution.
#
# Install with `crontab -e`:
#   15 6 * * * /Users/apple/Desktop/LokDarpan/services/ingestion/scripts/daily-sweep.sh
#
# WHY THIS FAILS LOUDLY
# A sweep that runs with the database down finishes quickly, reports nothing
# collected, and leaves no trace that anything was wrong. Overnight that reads
# as "the portals advertised nothing" — a false statement about twenty
# governments. Every precondition is checked before a single request is made,
# and a failure is written to the log with its reason.

set -uo pipefail

REPO="/Users/apple/Desktop/LokDarpan"
LOG_DIR="${HOME}/Library/Logs/lokdarpan"
LOG="${LOG_DIR}/gepnic-sweep.log"

mkdir -p "${LOG_DIR}"

say() {
    printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"${LOG}"
}

fail() {
    say "ABORTED: $1"
    exit 1
}

say "--- sweep starting"

# nvm installs node per version, so this path moves when node is upgraded.
# Resolved rather than pinned: a hardcoded version silently stops working on the
# next upgrade, and cron would report only "pnpm: command not found".
NODE_BIN="$(ls -d "${HOME}"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
[ -n "${NODE_BIN}" ] || fail "no node installation found under ~/.nvm"
export PATH="${NODE_BIN}:/usr/local/bin:/usr/bin:/bin"

command -v pnpm >/dev/null || fail "pnpm not on PATH (${NODE_BIN})"

# ONE VARIABLE, NOT THE WHOLE FILE.
#
# Credentials live in the gitignored env file and are never written here. This
# reads only DATABASE_URL rather than sourcing the file with `set -a`, because
# that file also holds unrelated API keys — and exporting those into a process
# that then makes requests to twenty-one outside hosts widens their exposure
# for no reason. A crash dump or a stray diagnostic would carry them.
#
# Sourcing also executes the file, so any command in it runs with this script's
# privileges. Reading one line does not.
[ -f "${REPO}/.env.local" ] || fail "${REPO}/.env.local is missing"
DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "${REPO}/.env.local" | head -1 | sed 's/^["'"'"']//; s/["'"'"']$//')"
export DATABASE_URL
[ -n "${DATABASE_URL:-}" ] || fail ".env.local sets no DATABASE_URL"

# The ledger lives in Docker on this machine. Checking that it answers is the
# difference between "no tenders were advertised" and "we could not look".
docker info >/dev/null 2>&1 || fail "Docker is not running"
docker exec lokdarpan-postgres pg_isready -U lokdarpan >/dev/null 2>&1 ||
    fail "Postgres is not accepting connections"

cd "${REPO}/services/ingestion" || fail "cannot enter the ingestion package"

# The sweep is slow on purpose — a pause between detail pages and a longer one
# between portals — so roughly twenty minutes is the expected duration, not a
# hang.
if pnpm ingest:gepnic --all >>"${LOG}" 2>&1; then
    say "--- sweep finished"
else
    say "--- sweep exited non-zero (see output above)"
    exit 1
fi
