#!/usr/bin/env bash
#
# Deterministic dashboard deploy. One command, no ping-pong.
#
#   ssh root@<vps> "bash /home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web/deploy/deploy.sh"
#
# What it does (idempotent, safe to re-run):
#   1. Fetch origin/main and force the dashboard source to the canonical pushed
#      version — never builds from a messy working tree or a stuck autostash.
#   2. Remove any /pixel prototype route (one-dashboard rule).
#   3. Build as the openclaw user (root-run builds leave root-owned .next -> blocks
#      future builds; this avoids that class of failure).
#   4. rsync --delete to the web root (clears stale files like old pixel.html).
#   5. Verify the live URL returns 200, or exit non-zero.
#
set -euo pipefail

WORKSPACE="/home/openclaw/.openclaw/workspace"
APP_DIR="$WORKSPACE/agents/goop/openclaw-dashboard-web"
WEB_ROOT="/var/www/openclaw-dashboard-web/"
LIVE_URL="https://dashboard.vpszeimhahnu.uk/"
BUILD_USER="openclaw"

echo "==> [1/5] Fetch + force dashboard source to origin/main"
cd "$WORKSPACE"
git fetch origin main
git checkout origin/main -- agents/goop/openclaw-dashboard-web/

echo "==> [2/5] Remove /pixel prototype route if present"
rm -rf "$APP_DIR/src/app/pixel"

echo "==> [3/5] Build as $BUILD_USER"
if [ "$(id -un)" = "$BUILD_USER" ]; then
  ( cd "$APP_DIR" && npm run build )
else
  su -s /bin/bash "$BUILD_USER" -c "cd '$APP_DIR' && npm run build"
fi

echo "==> [4/5] Deploy to $WEB_ROOT"
rsync -a --delete "$APP_DIR/out/" "$WEB_ROOT"

echo "==> [5/5] Verify $LIVE_URL"
code="$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_URL")"
if [ "$code" = "200" ]; then
  echo "OK: dashboard live (HTTP $code)"
else
  echo "FAIL: dashboard returned HTTP $code" >&2
  exit 1
fi
