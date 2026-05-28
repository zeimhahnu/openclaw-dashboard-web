# Dashboard Auto-Deploy Setup

## What this does

- **Cron (auto):** Every 5 min, VPS checks for new commits → builds → deploys. Zero Telegram action needed.
- **Webhook (on-demand):** Instant deploy via `curl` — for urgent changes.

Both can run simultaneously without conflict (lock file prevents overlap).

---

## Step 1 — On VPS: Make scripts executable

```bash
chmod +x /home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web/deploy/cron-deploy.sh
chmod +x /home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web/deploy/webhook-deploy.sh
```

---

## Step 2 — On VPS: Add cron (auto-deploy)

```bash
crontab -e
# Add this line:
*/5 * * * * /home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web/deploy/cron-deploy.sh 2>&1
```

The cron calls `cron-deploy.sh` which:
1. Checks `git fetch` for new commits
2. Only builds if something changed (avoids wasted CPU)
3. Holds a lock so webhook and cron can't overlap

---

## Step 3 — On VPS: Set webhook secret

Edit `/home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web/deploy/webhook-deploy.sh` and change:

```
EXPECTED_TOKEN="CHANGE_ME_TO_A_RANDOM_SECRET"
```

Pick a long random string (e.g. `openssl rand -hex 32`).

---

## Step 4 — On VPS: Configure nginx webhook

Add this to your nginx site config (before the `location /` block):

```nginx
location /deploy {
    limit_except GET POST { deny all; }
    if ($arg_token = "YOUR_SECRET_HERE") {
        proxy_pass http://unix:/tmp/deploy.sock;
    }
    return 204;
}
```

Then reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 5 — (Optional) Enable webhook trigger from Lil Claw

Once secret is set, Lil Claw can call:

```bash
curl -X POST "https://dashboard.vpszeimhahnu.uk/deploy?token=YOUR_SECRET_HERE"
```

Add this as a Lil Claw command or a `deploy` task in the inbox.

---

## Test it

```bash
# Check cron is active
crontab -l

# Test webhook locally
bash /home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web/deploy/webhook-deploy.sh YOUR_SECRET_HERE

# Check logs
tail -f /tmp/dashboard-deploy.log
```

---

## Files involved

| File | Purpose |
|------|---------|
| `deploy/cron-deploy.sh` | Smart cron runner (checks for new commits first) |
| `deploy/webhook-deploy.sh` | On-demand deploy (validates token) |
| `deploy/nginx-webhook.conf` | Nginx config snippet |
| `/tmp/dashboard-deploy.log` | Deploy log (troubleshoot here) |
| `/tmp/dashboard-deploy.lock` | Lock file (prevents concurrent runs) |