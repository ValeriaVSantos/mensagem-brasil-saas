# Mensagem Brasil — Production-Grade LLM Application for Personalized Text Generation via WhatsApp

https://mensagem-brasil.com/

> A multi-tenant SaaS that generates and delivers personalized, daily messages to WhatsApp recipients using GPT-4o (text) and DALL·E 3 (image), with a fixed monthly infrastructure cost of approximately **US$3.50**, independent of message volume.

[![Stack](https://img.shields.io/badge/stack-Node.js%20%7C%20PostgreSQL%20%7C%20Docker-2ea44f)](#tech-stack)
[![LLM](https://img.shields.io/badge/LLM-GPT--4o%20%2B%20DALL·E%203-blue)](#nlp-and-prompt-engineering)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)
[![Status](https://img.shields.io/badge/status-production-success)](#)

**Authors:** Luis Augusto Caetano · Valeria Vieira Santos
**Domain:** Applied NLP · LLM Systems · Controllable Text Generation · Multimodal AI
**Year:** 2026

📄 **Read the full documentation in PT-BR:** [README in Portuguese](README.pt.md)

---

## TL;DR

This repository documents the design, implementation, and production deployment of a **real-world LLM application** that generates personalized natural-language messages conditioned on per-recipient parameters (recipient name, intended tone, semantic theme) and delivers them through a personal WhatsApp channel. The system is fully containerized, runs on a single x86 cloud instance, and orchestrates GPT-4o, DALL·E 3, the WhatsApp protocol, and a no-code automation layer (Make / Integromat).

The work is documented here in two complementary forms:

1. **Step-by-step technical guide** — every command, configuration file, and design decision required to reproduce the system from scratch ([PDF](docs/pdfs/guia-construcao-servidor-github.pdf)).
2. **Technical case study** — the architectural reasoning, infrastructure trade-offs, and lessons learned from the deployment ([PDF](docs/pdfs/case-tecnico-github.pdf)).

---

## Why This Project Matters for NLP / Computational Linguistics

Although the system was built as a commercial product, it surfaces several research-relevant questions in applied computational linguistics:

| Research Angle | What This System Demonstrates |
|---|---|
| **Controllable text generation** | Conditioning LLM output on a tuple `(name, tone, theme)` to produce stylistically distinct yet semantically faithful short-form messages. |
| **Prompt engineering as interface design** | The prompt is the contract between business logic and the model — see [`examples/prompts/message-generation.md`](examples/prompts/message-generation.md) for the production prompt and ablations. |
| **Multimodal generation pipelines** | Coordinating text (GPT-4o) and image (DALL·E 3) generation per message, with shared semantic conditioning. |
| **LLM-in-the-loop production systems** | Reliability patterns (retries, fallbacks, monitoring) when an LLM is on the hot path of a daily delivery SLA. |
| **Low-resource Portuguese NLP** | The system generates idiomatic Brazilian Portuguese (BP) at scale; prompt design choices matter for register and naturalness. |

A research extension is sketched in [`docs/research-directions.md`](docs/research-directions.md).

---

## Architecture

```
                 ┌──────────────────────────────────────────┐
                 │  Make (orchestration)                    │
                 │  ┌────────────┐   ┌────────────────┐     │
                 │  │ Onboarding │   │ Daily delivery │     │
                 │  │  scenario  │   │   scenario     │     │
                 │  └─────┬──────┘   └────────┬───────┘     │
                 └────────┼───────────────────┼─────────────┘
                          │                   │
                          ▼                   ▼
   ┌─────────────────────────────────────────────────────┐
   │  Hetzner CX23 (x86, Ubuntu 24.04) · Cloudflare Tunnel│
   │                                                      │
   │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐    │
   │  │ Dashboard│  │ Evolution│  │ PostgreSQL 15    │    │
   │  │ Node.js  │◀─│ API +    │◀─│ (clientes,       │    │
   │  │ + Express│  │ Baileys  │  │  contatos,       │    │
   │  │ + PM2    │  │ (WhatsApp│  │  envios)         │    │
   │  │          │  │  bridge) │  │                  │    │
   │  └────┬─────┘  └─────┬────┘  └──────────────────┘    │
   │       │              │       ┌──────────────────┐    │
   │       └──────────────┴──────▶│  Redis 7 (cache) │    │
   │                              └──────────────────┘    │
   └─────────────────┬────────────────────────────────────┘
                     │
                     ▼
       ┌──────────────────────────────┐
       │  External services           │
       │  • OpenAI (GPT-4o, DALL·E 3) │
       │  • Resend (transactional EM) │
       │  • Kiwify (payments)         │
       │  • UptimeRobot (monitoring)  │
       └──────────────────────────────┘
```

A higher-resolution architecture diagram is available in [`images/architecture.svg`](images/architecture.svg).

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Compute** | Hetzner Cloud CX23 (2 vCPU x86, 4 GB RAM) | Lowest cost-per-RAM among evaluated providers (~10× cheaper than AWS Lightsail). x86 is non-negotiable: ARM64 silently breaks Baileys. |
| **Containers** | Docker Compose | Reproducible service topology for PostgreSQL, Redis, and the WhatsApp bridge. |
| **WhatsApp bridge** | Evolution API v2 + Baileys | Only viable open-source path to use the user's *personal* WhatsApp number (vs. WABA-style official APIs). |
| **Persistence** | PostgreSQL 15 | ACID, native UUID/JSON support, well-supported by the WhatsApp bridge. |
| **Cache / sessions** | Redis 7 Alpine | Session storage for the WhatsApp bridge. |
| **Edge / TLS** | Cloudflare Tunnel | Zero-IP-exposure HTTPS, no certificate rotation, free DDoS protection. |
| **Backend** | Node.js 20 + Express + PM2 | Lightweight, mature ecosystem, automatic restart. |
| **Text LLM** | OpenAI GPT-4o | Naturalness of generated messages is the product. |
| **Image LLM** | OpenAI DALL·E 3 | One unique image per message per day. |
| **Orchestration** | Make (Integromat) | No-code orchestration of payment → onboarding → daily delivery. |
| **Payments** | Kiwify + webhooks | Brazilian-market checkout with reliable webhook semantics. |
| **Email** | Resend | 3,000 free transactional emails/month. |
| **Monitoring** | UptimeRobot | Free 5-minute interval HTTP monitoring with email alerts. |

---

## Repository Layout

```
mensagem-brasil-saas/
├── README.md                      ← you are here (English)
├── README.pt.md                   ← Portuguese version
├── LICENSE                        ← MIT
├── CITATION.cff                   ← citation metadata
├── .gitignore
│
├── docs/
│   ├── architecture.md            ← architectural decisions
│   ├── deployment-guide.md        ← summary of the step-by-step guide
│   ├── lessons-learned.md         ← non-obvious pitfalls and fixes
│   ├── research-directions.md     ← open NLP/CL questions this system surfaces
│   └── pdfs/
│       ├── guia-construcao-servidor-github.pdf
│       └── case-tecnico-github.pdf
│
├── infrastructure/
│   ├── docker-compose.yml         ← full service topology
│   ├── cloudflare-tunnel/
│   │   └── config.yml.example
│   └── backup/
│       └── backup.sh              ← daily pg_dump with 7-day retention
│
├── examples/
│   ├── dashboard/
│   │   ├── server.js              ← Express + security middleware
│   │   ├── middleware/auth.js     ← JWT authentication
│   │   └── routes/
│   │       ├── auth-create.js     ← onboarding endpoint
│   │       └── daily-delivery.js  ← daily delivery query endpoint
│   └── prompts/
│       └── message-generation.md  ← production prompt + ablations
│
├── database/
│   └── schema.sql                 ← clientes, contatos, envios
│
└── images/
    └── architecture.svg
```

---

## Quick Start (Reproduction)

The full reproduction instructions are in [`docs/deployment-guide.md`](docs/deployment-guide.md). At a high level:

1. Provision a Hetzner CX23 instance (x86, **never** CAX/ARM).
2. Configure the firewall — most importantly, allow **outbound UDP 7844** for Cloudflare Tunnel QUIC.
3. Install Docker and run `docker compose up -d` against [`infrastructure/docker-compose.yml`](infrastructure/docker-compose.yml).
4. Configure Cloudflare Tunnel using [`infrastructure/cloudflare-tunnel/config.yml.example`](infrastructure/cloudflare-tunnel/config.yml.example).
5. Apply the database schema in [`database/schema.sql`](database/schema.sql).
6. Deploy the dashboard from [`examples/dashboard/`](examples/dashboard/) and start it with PM2.
7. Wire the three Make scenarios (onboarding, daily delivery, disconnection alert).
8. Schedule the backup script in [`infrastructure/backup/backup.sh`](infrastructure/backup/backup.sh) via cron.

---

## NLP and Prompt Engineering

The text-generation prompt is the most research-relevant artifact in this repository. The production prompt conditions the model on three slot fillers:

```
Você é um assistente que escreve mensagens de bom dia.
Escreva uma mensagem curta (2-3 frases) para {nome}.
Tom: {tom}. Tema preferido: {tema}.
A mensagem deve parecer escrita por uma pessoa real,
não por um sistema automatizado.
Não use emojis em excesso. Seja genuíno.
Não mencione que a mensagem foi gerada por IA.
```

Design choices worth noting:

- **Length constraint as a hard register signal.** "2–3 frases" forces concision and discourages the model's default tendency to over-elaborate, which reads as artificial in WhatsApp register.
- **Negative constraints to suppress AI tells.** `"não mencione que a mensagem foi gerada por IA"` and the emoji constraint reduce the most common artifacts of LLM-generated Portuguese.
- **Tone as a controllable variable.** `{tom}` ∈ {`carinhoso`, `motivacional`, `espiritual`, …} enables stylistic variation without retraining.
- **Theme as a soft semantic anchor.** `{tema}` biases content without dictating it, leaving room for natural variation across days.

A more detailed write-up — including failure modes, ablations, and a discussion of how this prompt compares to controllable-generation literature — is in [`examples/prompts/message-generation.md`](examples/prompts/message-generation.md).

---

## Lessons Learned (Selected)

The full list is in [`docs/lessons-learned.md`](docs/lessons-learned.md). The ones that cost us the most debugging time:

1. **ARM64 silently breaks WhatsApp connectivity.** Baileys is incompatible with ARM64. Containers start, the API responds, the QR code generates — and then the WhatsApp connection fails without a clear error. Always use x86 (Hetzner CX, never CAX).
2. **Cloudflare Tunnel needs UDP 7844 outbound.** Without it, the tunnel enters a silent reconnect loop. `systemctl status cloudflared` reports `active`. The logs show only retry attempts.
3. **`express-rate-limit` requires `trust proxy`.** Behind Cloudflare, every request appears to come from a single IP unless `app.set('trust proxy', 1)` is set *before* the rate limiter. Otherwise legitimate users hit 429s within minutes.
4. **Cloudflare caches your dashboard JS aggressively.** New deploys silently don't propagate to clients. Add a `Bypass cache` rule for the dashboard hostname.

---

## Results

| Metric | Value |
|---|---|
| Infrastructure cost | ~US$3.50/month, fixed |
| Cost per generated message | < US$0.001 (LLM tokens only) |
| Onboarding latency (payment → first login) | < 2 minutes |
| Backup recovery time | < 5 minutes |
| Monitored uptime | 100% over the observation window |

---

## How to Cite

If this work informs your research or teaching, please cite using the [`CITATION.cff`](CITATION.cff) file or:

> Caetano, L. A., & Santos, V. V. (2026). *Mensagem Brasil — Production-Grade LLM Application for Personalized Text Generation via WhatsApp.* GitHub repository.

---

## License

Released under the [MIT License](LICENSE). The PDFs in `docs/pdfs/` are released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

## Authors

- **Luis Augusto Caetano** — system architecture, backend, infrastructure
- **Valeria Vieira Santos** — co-author, NLP/prompt design, documentation, product

Contact and full author bios in [`CITATION.cff`](CITATION.cff).
