# Dashboard Cooperation Protocol

**Canonical frontend:** `agents/goop/openclaw-dashboard-web/`
**Live URL:** `https://dashboard.vpszeimhahnu.uk/`
**API (VPS):** `agents/goop/openclaw-dashboard/main.py` on port 8443

---

## Role split

| Who   | Owns                                        | Does NOT touch                  |
|-------|---------------------------------------------|----------------------------------|
| Mason | Design decisions, component code, UX vision | VPS build/deploy process         |
| Goop  | Build pipeline, VPS deploy, API backend     | Component design decisions       |

**Mason is the design owner.** All new components, layout changes, and visual decisions flow through Mason → `main` branch → push → dispatch deploy task to Goop.

**Goop is the build owner.** Goop does not edit frontend components unless Mason explicitly delegates or is unavailable. When Goop wants to experiment (as with the pixel route), it builds in a sandbox environment (see Staging section) and writes an ADR — Mason then decides what to absorb into `main`.

---

## Normal deploy flow

```
Mason codes → git commit → git push origin main
     ↓
Mason writes task file to tasks/goop/inbox/
     ↓
Goop picks up task → VPS pull → build → deploy
```

### Mason's dispatch task format

Create `tasks/goop/inbox/task-YYYY-MM-DD-dashboard-deploy.json`:

```json
{
  "id": "task-YYYY-MM-DD-dashboard-deploy",
  "type": "dashboard-deploy",
  "priority": "medium",
  "description": "Pull latest main, rebuild openclaw-dashboard-web, deploy to /var/www/",
  "assignedBy": "mason",
  "details": {
    "branch": "main",
    "build_cmd": "cd /home/openclaw/.openclaw/workspace/agents/goop/openclaw-dashboard-web && npm run build",
    "deploy_cmd": "rsync -av --delete out/ /var/www/openclaw-dashboard-web/",
    "pre": "cd /home/openclaw/.openclaw/workspace && git pull --rebase"
  }
}
```

### Goop's build steps (for reference)

```bash
# Run as openclaw user
cd /home/openclaw/.openclaw/workspace
git pull --rebase

cd agents/goop/openclaw-dashboard-web
npm run build      # Next.js static export → out/

rsync -av --delete out/ /var/www/openclaw-dashboard-web/
```

**IMPORTANT:** Always run the build as the `openclaw` user, not root.
Root-owned `.next/` files block future builds. If this happens:
```bash
su -s /bin/bash openclaw -c "rm -rf /path/to/.next"
```

---

## Staging environment

**When to use:** New design directions, experimental components, anything that might regress the live dashboard.

### Setup (one-time, Goop does this once)

1. Create `/etc/nginx/sites-available/dashboard-staging` (or add a location block):
   ```nginx
   location /staging/ {
     alias /var/www/openclaw-dashboard-staging/;
     try_files $uri $uri/ /staging/index.html;
   }
   ```

2. Create the staging directory:
   ```bash
   mkdir -p /var/www/openclaw-dashboard-staging
   chown openclaw:openclaw /var/www/openclaw-dashboard-staging
   ```

### Staging deploy flow

Goop experiments on a `staging` branch:

```bash
git checkout -b staging
# ... make changes ...
git commit
# Build and deploy to staging
npm run build
rsync -av --delete out/ /var/www/openclaw-dashboard-staging/
```

**Mason's review step:** Mason reviews at `https://dashboard.vpszeimhahnu.uk/staging/` → gives feedback → Goop iterates → Mason decides what to port to `main`.

Goop should write a brief ADR in `SPECS/` for any non-trivial staging experiments (as done with `adr-pixel-dashboard-2026-05-27.md`). This creates a paper trail and surfaces design decisions for Mason to evaluate.

### What goes to staging vs main

| Change type                        | Route        |
|------------------------------------|--------------|
| New component design (untested)    | staging      |
| Data/API changes (backend)         | main + API   |
| Bug fixes                          | main direct  |
| Confirmed improvements from Mason  | main         |
| Goop experiments (self-initiated)  | staging only |

---

## API backend

**Running process:** `openclaw-dashboard/main.py` via uvicorn on port 8443.

- **Always restart as:** `su -s /bin/bash openclaw -c 'cd ... && nohup uvicorn main:app ...'`
- **Check PID:** `cat /tmp/dashboard-api.pid` or `lsof -i :8443`
- **Log tail:** `tail -f /tmp/dashboard-api.log`

When Mason adds new API fields to the frontend (new interfaces in `useDashboardApi.ts`), a matching endpoint must exist in `main.py`. Coordinate via Telegram or dispatch a task before pushing.

---

## One dashboard rule

There is **one canonical dashboard** at `/`. No parallel routes serving the same purpose.

If Goop builds a prototype on a `/pixel` or similar route:
1. It stays untracked (do not commit to `main`)
2. Write an ADR in `SPECS/`
3. Mason reviews and decides: absorb concepts into `main` or discard
4. The prototype route is removed from VPS working tree after review

---

## Summary: when to ping each other

| Situation                              | Action                                               |
|----------------------------------------|------------------------------------------------------|
| Mason pushes new frontend code         | Dispatch `dashboard-deploy` task to Goop inbox       |
| Goop wants to try something new        | Use staging branch + write ADR                       |
| API endpoint added/changed             | Goop notifies Mason via Telegram before merging      |
| Build fails on VPS                     | Goop investigates, reports in Telegram group         |
| Mason not available, urgent fix needed | Goop may fix, but documents in ADR + pings Mason     |
