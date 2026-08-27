#!/usr/bin/env bash
# Task 2.12: build the Capacitor static-export variant.
#
# app/api and the PWA manifest route are moved aside for the duration of the
# build: dynamic route handlers throw under output: 'export'. Neither route
# runs inside the native WebView. The trap restores them on every exit path,
# success or failure.
#
# Verification is content-based, not exit-code-based: the build must have
# produced the three app surfaces or this script fails.
set -euo pipefail
cd "$(dirname "$0")/.."

HOLD=".mobile-build-hold"

restore() {
  local failed=0
  if [ -d "$HOLD/api" ]; then
    if [ -e app/api ]; then
      echo "ERROR: cannot restore app/api because the destination exists" >&2
      failed=1
    elif ! mv "$HOLD/api" app/api; then
      failed=1
    fi
  fi
  if [ -f "$HOLD/run_status.ts" ]; then
    if [ -e scripts/run_status.ts ]; then
      echo "ERROR: cannot restore scripts/run_status.ts because the destination exists" >&2
      failed=1
    elif ! mv "$HOLD/run_status.ts" scripts/run_status.ts; then
      failed=1
    fi
  fi
  if [ -f "$HOLD/manifest.ts" ]; then
    if [ -e app/manifest.ts ]; then
      echo "ERROR: cannot restore app/manifest.ts because the destination exists" >&2
      failed=1
    elif ! mv "$HOLD/manifest.ts" app/manifest.ts; then
      failed=1
    fi
  fi
  if [ -d "$HOLD" ] && ! rmdir "$HOLD"; then
    echo "ERROR: mobile build hold directory still contains recovery data" >&2
    failed=1
  fi
  return "$failed"
}

finish() {
  local status=$?
  trap - EXIT HUP INT TERM
  if ! restore; then
    exit 1
  fi
  exit "$status"
}

finish_signal() {
  local status="$1"
  trap - EXIT HUP INT TERM
  if ! restore; then
    exit 1
  fi
  exit "$status"
}

if [ -e "$HOLD" ]; then
  echo "ERROR: $HOLD already exists; recover or remove it before building" >&2
  exit 1
fi

for source in app/api scripts/run_status.ts app/manifest.ts; do
  if [ ! -e "$source" ]; then
    echo "ERROR: missing required mobile build source: $source" >&2
    exit 1
  fi
done

trap finish EXIT
trap 'finish_signal 129' HUP
trap 'finish_signal 130' INT
trap 'finish_signal 143' TERM

# scripts/run_status.ts imports the status route, so it moves with it.
mkdir "$HOLD"
mv app/api "$HOLD/api"
mv scripts/run_status.ts "$HOLD/run_status.ts"

# The web manifest is a Next metadata route. It belongs in the PWA build but
# has no native runtime consumer and Next 16.3 rejects it during static export.
mv app/manifest.ts "$HOLD/manifest.ts"

rm -rf out
MOBILE_BUILD=1 npx next build

test -f out/index.html
test -f out/mission/index.html
test -f out/judge/index.html
echo "mobile export OK: out/ contains index, mission and judge surfaces"
