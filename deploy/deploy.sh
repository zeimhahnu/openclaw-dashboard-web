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

# Loud failure: never die silently into a log nobody reads. The 2026-05-28
# incident was an rsync permission error buried in /tmp/dashboard-deploy.log
# for hours. Any non-zero exit now prints an unmistakable banner.
trap 'echo "============================================================"; echo "DEPLOY FAILED at line $LINENO (exit $?). Dashboard NOT updated."; echo "============================================================" >&2' ERR

echo "==> [0/5] Preflight: web root ownership invariant"
# The deploy runs as $BUILD_USER. If anything under the web root is owned by
# another user (e.g. a stray root-owned file from a manual scp), rsync --delete
# cannot remove it and the whole deploy fails. Detect early with the exact fix.
if [ -d "$WEB_ROOT" ]; then
  foreign="$(find "$WEB_ROOT" ! -user "$BUILD_USER" 2>/dev/null | head -5 || true)"
  if [ -n "$foreign" ]; then
    echo "FAIL: web root has files NOT owned by $BUILD_USER — rsync will be denied." >&2
    echo "Offending (first 5):" >&2; echo "$foreign" >&2
    echo "Remediation (run as root): chown -R $BUILD_USER:$BUILD_USER $WEB_ROOT" >&2
    echo "Root cause: deploy ONLY via this script as $BUILD_USER. Never scp as root." >&2
    exit 1
  fi
fi

echo "==> [1/5] Fetch + force dashboard source to origin/main"
# The dashboard is its OWN git repo ($APP_DIR / zeimhahnu/openclaw-dashboard-web),
# separate from the workspace repo. Operate inside it and force the source to the
# canonical pushed version so we never build from a messy working tree, a stuck
# autostash, or unattended-agent edits. (Previously this ran in $WORKSPACE and did
# `git checkout origin/main -- <dashboard path>`, which failed with "pathspec did
# not match" because that path is not tracked in the workspace repo.)
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main
# Drop untracked source files (e.g. an unattended agent's orphan components). Scoped
# to src/ and ignored build dirs (node_modules/.next/out) are preserved by gitignore.
git clean -fd src/

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
# The site is behind nginx HTTP Basic auth ("OpenClaw Mission Control"). An
# unauthenticated curl gets 401 — that still proves nginx is up and serving the
# deployed static site. Treat 200 and 401 as live; anything else (5xx/000/404) fails.
code="$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_URL")"
if [ "$code" = "200" ] || [ "$code" = "401" ]; then
  echo "OK: dashboard live (HTTP $code$([ "$code" = "401" ] && echo " — basic-auth challenge, nginx serving"))"
else
  echo "FAIL: dashboard returned HTTP $code" >&2
  exit 1
fi
