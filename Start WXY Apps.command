#!/bin/bash
# Double-click to start Site Brief (http://localhost:3101) and Massing Studio (http://localhost:3301).
# First run installs dependencies (a few minutes). Close this window or press Ctrl-C to stop both apps.

cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"
SITE_BRIEF="$ROOT/Project-1_Code-Zoning-Research-Assistant/1B_Site-Brief/app"
ENGINE="$ROOT/Project-3_AI-Massing-Generation/shared/massing"
MASSING="$ROOT/Project-3_AI-Massing-Generation/3A_Massing-Studio/app"
SITE_BRIEF_PORT=3101
MASSING_PORT=3301

say() { printf "\n\033[1m%s\033[0m\n" "$1"; }
fail() { say "$1"; echo "Press Return to close."; read -r _; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  fail "Node.js isn't installed. Install the LTS version from https://nodejs.org, then double-click this file again."
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  fail "Node.js $(node -v) is too old. Install version 20 or newer from https://nodejs.org."
fi

install_if_needed() { # $1 folder, $2 name
  if [ ! -d "$1/node_modules" ]; then
    say "Installing $2 (first run only)…"
    (cd "$1" && npm install --no-fund --no-audit) || fail "Couldn't install $2. Check your internet connection and try again."
  fi
}
install_if_needed "$ENGINE" "the massing engine"
install_if_needed "$MASSING" "Massing Studio"
install_if_needed "$SITE_BRIEF" "Site Brief"

port_in_use() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

PIDS=()
start_app() { # $1 folder, $2 port, $3 name
  if port_in_use "$2"; then
    say "$3 is already running on port $2."
    return
  fi
  # Production build: faster pages, and iPads/phones on the same Wi-Fi can open it (the dev server blocks other hosts).
  # Rebuild only when a source file is newer than the last build.
  local stamp="$1/.next/BUILD_ID"
  if [ ! -f "$stamp" ] || [ -n "$(find "$1" "$ENGINE/src" \( -path '*/node_modules' -o -path '*/.next' -o -path '*/test-results' \) -prune -o -type f -newer "$stamp" \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' -o -name '*.json' -o -name '*.mjs' \) -print -quit)" ]; then
    say "Building $3 (only after changes; about a minute)…"
    (cd "$1" && npx next build >"$ROOT/.wxy-$2-build.log" 2>&1) || fail "$3 didn't build. The log is in .wxy-$2-build.log in this folder."
  fi
  say "Starting $3 on http://localhost:$2 …"
  (cd "$1" && npx next start -p "$2" >"$ROOT/.wxy-$2.log" 2>&1) &
  PIDS+=($!)
}

stop_all() {
  [ ${#PIDS[@]} -eq 0 ] && exit 0
  say "Stopping the apps…"
  for pid in "${PIDS[@]}"; do pkill -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null; done
  exit 0
}
trap stop_all INT TERM HUP

start_app "$SITE_BRIEF" "$SITE_BRIEF_PORT" "Site Brief"
start_app "$MASSING" "$MASSING_PORT" "Massing Studio"

wait_for() { # $1 port, $2 name
  for _ in $(seq 1 90); do
    curl -s -o /dev/null "http://localhost:$1" && return 0
    sleep 1
  done
  fail "$2 didn't start. The log is in .wxy-$1.log in this folder."
}
wait_for "$SITE_BRIEF_PORT" "Site Brief"
wait_for "$MASSING_PORT" "Massing Studio"

open "http://localhost:$SITE_BRIEF_PORT"
say "Both apps are running."
echo "  Site Brief      http://localhost:$SITE_BRIEF_PORT"
echo "  Massing Studio  http://localhost:$MASSING_PORT"
echo "  On an iPad or phone on the same Wi-Fi, use this Mac's address instead of localhost:"
echo "  http://$(ipconfig getifaddr en0 2>/dev/null || echo 'this-mac-ip'):$SITE_BRIEF_PORT"
echo
echo "Leave this window open while you work. Close it or press Ctrl-C to stop both apps."

if [ ${#PIDS[@]} -gt 0 ]; then wait; else echo "(The apps were already running, so nothing to stop here.)"; read -r _; fi
