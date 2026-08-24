#!/usr/bin/env bash
# Task 2.12: build the Capacitor static-export variant.
#
# app/api is moved aside for the duration of the build: dynamic route
# handlers (ask, status) throw under output: 'export'. The trap restores
# them on every exit path, success or failure.
#
# Verification is content-based, not exit-code-based: the build must have
# produced the three app surfaces or this script fails.
set -euo pipefail
cd "$(dirname "$0")/.."

HOLD=".mobile-build-hold"

restore() {
  if [ -d "$HOLD/api" ]; then
    mv "$HOLD/api" app/api
  fi
  if [ -f "$HOLD/run_status.ts" ]; then
    mv "$HOLD/run_status.ts" scripts/run_status.ts
  fi
  rmdir "$HOLD" 2>/dev/null || true
}
trap restore EXIT

# scripts/run_status.ts imports the status route, so it moves with it.
if [ -d app/api ]; then
  mkdir -p "$HOLD"
  mv app/api "$HOLD/api"
  mv scripts/run_status.ts "$HOLD/run_status.ts"
fi

rm -rf out
MOBILE_BUILD=1 npx next build

test -f out/index.html
test -f out/mission/index.html
test -f out/judge/index.html
echo "mobile export OK: out/ contains index, mission and judge surfaces"
