#!/usr/bin/env bash
#
# cron-deploy.sh — poll origin/main and auto-deploy the dashboard when it moves.
# Wired via the openclaw user's crontab (every 5 min). Idempotent + locked.
#
# Source of truth = origin/main. This script NEVER builds from the working tree.
# It tracks the last SHA it deployed in a marker file, so unrelated workspace
# commits (mason/lil-claw task files) don't trigger needless rebuilds, and a
# stale remote-tracking ref can't make it skip a real update.
#
set -euo pipefail

WORKSPACE="/home/openclaw/.openclaw/workspace"
DASHBOARD_DIR="$WORKSPACE/agents/goop/openclaw-dashboard-web"
DEPLOY_SCRIPT="$DASHBOARD_DIR/deploy/deploy.sh"
LOCK="/tmp/dashboard-deploy.lock"
LOG="/tmp/dashboard-deploy.log"
MARKER="$DASHBOARD_DIR/deploy/.last-deployed-sha"

log() { echo "[$(date)] $*" >> "$LOG"; }

# Already running?
if [ -f "$LOCK" ]; then
  log "Skip: lock held by $(cat "$LOCK" 2>/dev/null)"
  exit 0
fi

cd "$WORKSPACE"

# Explicit refspec so refs/remotes/origin/main is ALWAYS refreshed. Plain
# `git fetch origin main` only writes FETCH_HEAD on some git versions, which is
# what made the old check compare against a stale ref and skip real updates.
git fetch origin main:refs/remotes/origin/main >/dev/null 2>&1 || {
  log "FAIL: git fetch failed"; exit 1; }

REMOTE="$(git rev-parse refs/remotes/origin/main)"
LAST="$(cat "$MARKER" 2>/dev/null || echo none)"

if [ "$REMOTE" = "$LAST" ]; then
  log "Up-to-date at $REMOTE — skip"
  exit 0
fi

echo "$$" > "$LOCK"
trap 'rm -f "$LOCK"' EXIT
log "Deploying origin/main $LAST -> $REMOTE"

if bash "$DEPLOY_SCRIPT" >> "$LOG" 2>&1; then
  echo "$REMOTE" > "$MARKER"
  log "Done — deployed $REMOTE"
else
  log "DEPLOY FAILED — marker NOT advanced (will retry next cycle). See banner above."
  exit 1
fi
