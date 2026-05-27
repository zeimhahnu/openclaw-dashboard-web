#!/bin/bash
#───────────────────────────────────────────────────────────────────────────────
# S7-A: Deploy static Next.js dashboard via Nginx on VPS
# Usage: sudo bash deploy.sh [/path/to/repo]
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

# Build if out/ doesn't exist (gitignored — not in the repo)
if [ ! -d "$REPO_DIR/out" ] || [ -z "$(ls -A "$REPO_DIR/out" 2>/dev/null)" ]; then
    echo "==> out/ not found — cloning repo and building fresh..."
    BUILD_DIR=$(mktemp -d)
    git clone https://github.com/zeimhahnu/openclaw-dashboard-web.git "$BUILD_DIR"
    cd "$BUILD_DIR"
    npm install
    npm run build
    rsync -av --delete "$BUILD_DIR/out/" "$WEB_DIR/"
    cp "$BUILD_DIR/deploy/nginx-dashboard.conf" "/etc/nginx/sites-available/dashboard"
    ln -sf /etc/nginx/sites-available/dashboard "$NGINX_ENABLED"
    rm -rf "$BUILD_DIR"
else
    echo "==> Copying static files from out/..."
    rsync -av --delete "$REPO_DIR/out/" "$WEB_DIR/"
fi

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
echo "  1. npm run build   (run on VPS or local machine)"
echo "  2. rsync -av --delete ./out/ $WEB_DIR/"
echo ""
