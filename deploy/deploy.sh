#!/bin/bash
#───────────────────────────────────────────────────────────────────────────────
# S7-A: Deploy static Next.js dashboard via Nginx on VPS
# Usage: sudo bash deploy.sh
#───────────────────────────────────────────────────────────────────────────────

set -euo pipefail

WEB_DIR="/var/www/openclaw-dashboard-web"
NGINX_CONF="/etc/nginx/sites-available/dashboard"
NGINX_ENABLED="/etc/nginx/sites-enabled/dashboard"
REPO_DIR="${1:-.}"

echo "==> Checking prerequisites..."
if [ "$(uname -s)" != "Linux" ]; then
    echo "ERROR: This script must be run on the VPS (Linux)"
    exit 1
fi

echo "==> Installing Nginx..."
apt-get update -qq && apt-get install -y nginx

echo "==> Creating web directory..."
mkdir -p "$WEB_DIR"

echo "==> Copying static files..."
rsync -av --delete \
    "$REPO_DIR/out/" \
    "$WEB_DIR/"

echo "==> Installing Nginx config..."
cp "$REPO_DIR/deploy/nginx-dashboard.conf" "$NGINX_CONF"
ln -sf "$NGINX_CONF" "$NGINX_ENABLED"

# Disable default site
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

echo "==> Testing Nginx config..."
nginx -t

echo "==> Reloading Nginx..."
systemctl reload nginx

echo ""
echo "✓ Deployment complete!"
echo "  Dashboard: http://dashboard.vpszeimhahnu.uk"
echo "  (Static files in: $WEB_DIR)"
echo ""
echo "To rebuild after changes:"
echo "  1. npm run build   (run on local machine or VPS)"
echo "  2. rsync -av --delete ./out/ $WEB_DIR/"
echo ""
