#!/usr/bin/env bash
#
# cron-deploy.sh — smart auto-deploy with lock
# Run via cron every 5 min, or directly via webhook.
#
set -euo pipefail

APP_DIR="/home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web"
WEB_ROOT="/var/www/openclaw-dashboard-web/"
LOCK="/tmp/dashboard-deploy.lock"
LOG="/tmp/dashboard-deploy.log"
DEPLOY_SCRIPT="$APP_DIR/deploy/deploy.sh"

# --- Pre-exit checks ---
# Already running?
if [ -f "$LOCK" ]; then
  echo "[$(date)] Skip: lock held by $(cat $LOCK)" >> "$LOG"
  exit 0
fi

# Any new commits on origin/main?
cd "/home/openclaw/.openclaw/workspace"
git fetch origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "[$(date)] Up-to-date at $LOCAL — skip" >> "$LOG"
  exit 0
fi

# --- Deploy ---
echo "$$" > "$LOCK"
echo "[$(date)] Deploying $LOCAL → $REMOTE" >> "$LOG"

bash "$DEPLOY_SCRIPT" >> "$LOG" 2>&1

echo "[$(date)] Done" >> "$LOG"
rm -f "$LOCK"