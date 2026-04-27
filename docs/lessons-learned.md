# Lessons Learned

These are the non-obvious problems we hit during the build. None of them were clearly documented in the upstream references.

## CRITICAL — ARM64 silently breaks WhatsApp connectivity

**Context.** We initially provisioned a Hetzner CAX server (ARM64, ~30% cheaper than the equivalent CX). Everything came up: Docker, PostgreSQL, Redis, Evolution API. Logs showed `Server is running on port 8080`. The QR code generated and rendered correctly.

**Symptom.** Scanning the QR code with the WhatsApp app appeared to succeed — the QR code disappeared as expected. But the WhatsApp connection never moved to the `open` state. No error message, no exception, no log line. The instance simply stayed in `connecting` forever.

**Root cause.** Baileys, the JavaScript library that Evolution API wraps to speak the WhatsApp protocol, is not compatible with ARM64. The failure mode is silent because the library does not detect or report architecture incompatibility.

**Fix.** Use x86 (Intel/AMD) only. On Hetzner, that means the **CX** series — never CAX. Oracle Cloud Free Tier (ARM-only) and Apple Silicon dev environments are also ruled out for production.

## CRITICAL — Cloudflare Tunnel reconnects forever without UDP 7844

**Context.** After installing `cloudflared` and creating the tunnel, `systemctl status cloudflared` reported `active (running)`.

**Symptom.** Both `api.example.com` and `dashboard.example.com` returned Cloudflare error pages. The tunnel logs showed only repeated reconnection attempts with no clear error reason.

**Root cause.** Cloudflare Tunnel uses the QUIC protocol over UDP port 7844 for the outbound connection from the server to Cloudflare. The Hetzner firewall blocks this port by default. Without it, the tunnel cannot establish, but `cloudflared` reports itself as `active` because the daemon is running — just not connected.

**Fix.** Add an outbound rule on the Hetzner firewall: `Outbound · UDP · 7844 · Allow`. The tunnel connects within seconds.

## TECHNICAL — `express-rate-limit` blocks every user immediately

**Context.** After enabling rate limiting on the dashboard (100 requests / 15 minutes), all customer requests started returning HTTP 429.

**Symptom.** Even users making their first request of the day got rate-limited. The dashboard appeared completely broken to everyone simultaneously.

**Root cause.** Cloudflare proxies all incoming requests, so the source IP that Express sees is always a Cloudflare IP. Without `app.set('trust proxy', 1)`, `express-rate-limit` keys requests by that IP and considers all customer traffic as coming from a single client.

**Fix.** Set `app.set('trust proxy', 1)` *before* mounting `express-rate-limit`. Cloudflare's `X-Forwarded-For` header then provides the real client IP and rate limiting works correctly.

## TECHNICAL — Customers see stale JavaScript after deploys

**Context.** We pushed an update to the dashboard. PM2 restarted cleanly. Direct curl against the dashboard hostname returned the new bundle.

**Symptom.** Customers continued to see the old behavior, sometimes for hours. Hard refreshes (Ctrl+Shift+R) sometimes worked, sometimes didn't.

**Root cause.** Cloudflare's default cache rules apply to static assets including `.js`, `.css`, and `.html`. The new bundle reached Cloudflare but Cloudflare continued serving the cached version until the TTL expired.

**Fix.** Add a Cache Rule in the Cloudflare dashboard: `Caching → Cache Rules → Add Rule`. Match the dashboard hostname and set the policy to `Bypass cache`. From that point forward, every request hits the origin.

## BEST PRACTICE — No rollback path before structural changes

**Context.** Early in the build we ran an `ALTER TABLE` against the `clientes` table without taking a backup first.

**Symptom.** A typo in the migration removed a column with active production data. Recovery required several hours of manual reconstruction.

**Fix.** Always run `~/backup.sh` (or `pg_dump` directly) immediately before any schema change. The backup script takes under 30 seconds for our data size, and the restore takes under 5 minutes.

## BEST PRACTICE — Hardcoded credentials

**Context.** During the first sprint, we had API keys and database passwords inline in `server.js` for speed.

**Symptom.** A near-miss — we almost committed the file with credentials to a public repository.

**Fix.** Move every secret to a `.env` file loaded via `dotenv`. Add `.env` to `.gitignore` immediately after creating the project. Provide a `.env.example` with placeholder values for collaborators.

## Quick Diagnostic Reference

When something breaks, this is the order of operations:

```bash
# 1. Are containers up?
docker compose -f ~/evolution/docker-compose.yml ps

# 2. Is the dashboard process alive?
pm2 status

# 3. Is the tunnel connected?
systemctl status cloudflared

# 4. Recent dashboard errors?
pm2 logs dashboard --lines 50

# 5. Recent Evolution API errors?
docker compose -f ~/evolution/docker-compose.yml logs evolution --tail=50

# 6. WhatsApp instance state?
docker exec evolution-postgres psql -U evolution -d evolution \
  -c "SELECT id, email, whatsapp_status FROM clientes WHERE ativo = true;"
```
