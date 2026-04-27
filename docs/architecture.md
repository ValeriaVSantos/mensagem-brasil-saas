# Architecture

This document describes the architectural reasoning behind Mensagem Brasil.

## Goals and Constraints

The system was designed under three hard constraints:

1. **Fixed monthly cost, independent of message volume.** Per-message billing models (Twilio, Z-API) deteriorate margins exactly when the product grows.
2. **Personal WhatsApp number support.** The product connects each customer's *personal* WhatsApp account, ruling out the WhatsApp Business API (WABA) and any platform built on top of it.
3. **Single-operator maintainability.** Every component must be debuggable from a terminal by a single developer.

## High-Level Topology

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare (edge)                        │
│   api.example.com           dashboard.example.com           │
│         │                          │                        │
└─────────┼──────────────────────────┼────────────────────────┘
          │ Cloudflare Tunnel (UDP 7844 QUIC)
          │
┌─────────▼──────────────────────────▼────────────────────────┐
│  Hetzner CX23 — Ubuntu 24.04 — x86 (Intel/AMD)              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Docker network: evolution-net                          │ │
│  │                                                         │ │
│  │  ┌────────────┐  ┌──────────┐  ┌────────────────────┐  │ │
│  │  │ PostgreSQL │  │  Redis   │  │  Evolution API v2  │  │ │
│  │  │ 15-alpine  │◀─│ 7-alpine │◀─│  (Baileys bridge)  │  │ │
│  │  │  :5432     │  │  :6379   │  │     :8080          │  │ │
│  │  └────────────┘  └──────────┘  └─────────┬──────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                              │              │
│  ┌────────────────────┐                      │              │
│  │ Dashboard (Node.js)│◀─────────────────────┘              │
│  │ Express + PM2      │                                     │
│  │  :3000             │                                     │
│  └────────────────────┘                                     │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Cron · backup.sh · daily 02:00 · 7-day retention       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                                              │
                                              │
                ┌─────────────────────────────┼──────────────────────┐
                │                             │                      │
                ▼                             ▼                      ▼
       ┌────────────────┐           ┌──────────────┐        ┌────────────────┐
       │ OpenAI         │           │ Make         │        │ Resend         │
       │ • GPT-4o       │           │ (Integromat) │        │ (transactional │
       │ • DALL·E 3     │           │              │        │  email)        │
       └────────────────┘           └──────────────┘        └────────────────┘
```

## Key Architectural Decisions

### Why a self-hosted server instead of a managed WhatsApp platform

| Option | Why rejected |
|---|---|
| Twilio (WABA) | Requires a dedicated, Meta-approved business number. Cannot use the customer's personal number. |
| Z-API, WAPIkit (QR Code) | R$150–300/month per instance with daily message caps; cost grows linearly with customer count. |
| Self-hosted Evolution API | Fixed cost, full control over data, no per-message pricing. **Chosen.** |

### Why x86 over ARM64

Baileys (the underlying WhatsApp protocol implementation that Evolution API wraps) is incompatible with ARM64. Containers start, the API listens, the QR code generates — and the WhatsApp connection then fails *silently*, with no clear error in logs. This eliminated three otherwise attractive options:

- Hetzner CAX series (ARM, ~30% cheaper than CX)
- Oracle Cloud Free Tier (ARM)
- Apple Silicon dev environments mirroring production

### Why Cloudflare Tunnel instead of Nginx + Let's Encrypt

| Concern | Nginx + Certbot | Cloudflare Tunnel |
|---|---|---|
| IP exposure | Server IP is public | Server IP never exposed |
| TLS rotation | Manual or cron-managed | Cloudflare-managed |
| DDoS protection | DIY | Free with Cloudflare |
| Inbound firewall holes | 80, 443 open | None — outbound-only QUIC |
| Hidden gotcha | Renewal failures | UDP 7844 must be allowed outbound |

### Why PostgreSQL 15 specifically

Evolution API supports PostgreSQL natively. The default deployment guidance from Evolution targets PostgreSQL, and our schema reuses the same database for application-level entities (clientes, contatos, envios) to avoid running two databases on one CX23 instance.

### Why Make (Integromat) for orchestration

The daily delivery pipeline coordinates: a query against the dashboard, an LLM call per contact, an image-generation call per contact, a WhatsApp delivery call per contact, and a delivery-history write per contact. Implementing this in Node.js would require a queue, a worker, retries, and observability. Make provides all of that with no-code visibility — and the team can edit the pipeline without redeploying the backend.

The trade-off: Make has a paid plan (~US$10/month for the Core tier). For research reproductions, the same logic can be expressed in any orchestrator (Airflow, Prefect, Temporal) or a plain cron-driven Node.js worker.

## Data Model

Three tables, all in PostgreSQL 15:

- **`clientes`** — one row per paying customer. Fields: `id`, `nome`, `email`, `senha` (bcrypt salt 10), `plano`, `instance_name` (Evolution API instance), `whatsapp_status`, `ativo`, `onboarding_completo`, `reset_token`, `reset_expiry`, `criado_em`.
- **`contatos`** — one row per recipient configured by a customer. Fields: `id`, `cliente_id` (FK with cascade delete), `nome`, `numero`, `tom`, `tema`, `horario`, `ativo`, `criado_em`.
- **`envios`** — one row per delivered message. Fields: `id`, `cliente_id`, `contato_nome`, `contato_numero`, `mensagem`, `status`, `enviado_em`.

See [`database/schema.sql`](../database/schema.sql) for the full DDL.

## Security

- **No public ports beyond what Cloudflare needs.** SSH and Evolution API (8080) are bound to the server but reachable only via Cloudflare Tunnel routes.
- **`trust proxy` set before rate limiting.** Cloudflare injects the real client IP via `X-Forwarded-For`. Without trusting the proxy, every request appears to come from a single IP and rate limits trigger immediately.
- **Authentication via JWT with a 256-bit secret** (generated via `openssl rand -hex 32`). Tokens carry `cliente_id` only; all authorization is server-side.
- **Webhook auth via shared secret.** The Make → dashboard onboarding endpoint requires a header `X-Make-Secret` that is verified before any database write.
- **Helmet for HTTP security headers.** CSP is disabled to allow inline scripts in the dashboard; this is a known trade-off, not a security oversight.

## Reliability

- **`restart: always` on every Docker service.** Containers come back automatically after a host reboot.
- **PM2 manages the dashboard.** Process crashes are restarted within seconds and logged.
- **Daily `pg_dump` with 7-day retention.** Dumps are gzipped and rotated by the same script.
- **UptimeRobot HTTP monitoring** at 5-minute intervals against both `api.*` and `dashboard.*` hostnames.
- **Disconnected-WhatsApp alerts** via a second Make scenario at 06:05 daily that emails customers whose `whatsapp_status` is not `open`.

## Observed Limits and Future Work

- **One Hetzner CX23 instance handles N customers up to a memory ceiling.** Baileys instances each consume around 80–150 MB of RAM. With 4 GB available, the practical ceiling is roughly 20–25 active WhatsApp sessions before requiring vertical scaling.
- **No automatic failover.** A regional Hetzner outage takes the whole product offline. For a research extension, see `docs/research-directions.md` for HA designs.
- **Make is a single point of failure.** If Make is down at 06:00, no messages are delivered that day. UptimeRobot alerts on this indirectly via the WhatsApp disconnection check.
