#!/usr/bin/env bash
#
# webhook-deploy.sh — instant on-demand deploy
# Usage: webhook-deploy.sh <secret_token>
# Called by nginx on POST to /deploy?token=<secret>
#
set -euo pipefail

APP_DIR="/home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web"
WEB_ROOT="/var/www/openclaw-dashboard-web/"
LOCK="/tmp/dashboard-deploy.lock"
LOG="/tmp/dashboard-deploy.log"
DEPLOY_SCRIPT="$APP_DIR/deploy/deploy.sh"
EXPECTED_TOKEN="CHANGE_ME_TO_A_RANDOM_SECRET"

# Token check
TOKEN="${1:-}"
if [ "$TOKEN" != "$EXPECTED_TOKEN" ]; then
  echo "[$(date)] Unauthorized webhook attempt" >> "$LOG"
  exit 0  # silently reject, no info leak
fi

# Already running?
if [ -f "$LOCK" ]; then
  echo "[$(date)] Skip: lock held by $(cat $LOCK)" >> "$LOG"
  exit 0
fi

echo "$$" > "$LOCK"
echo "[$(date)] Webhook deploy triggered" >> "$LOG"
bash "$DEPLOY_SCRIPT" >> "$LOG" 2>&1
echo "[$(date)] Done" >> "$LOG"
rm -f "$LOCK"