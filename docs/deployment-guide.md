# Deployment Guide

This is a condensed reproduction guide. The full step-by-step is in the original PDF: [`pdfs/guia-construcao-servidor-github.pdf`](pdfs/guia-construcao-servidor-github.pdf).

## Prerequisites

- Hetzner Cloud account
- Registered domain with Cloudflare (free plan is fine)
- OpenAI account with credits (GPT-4o + DALL·E 3)
- Make (Integromat) Core plan
- Basic Linux/SSH familiarity

## Step 1 — Provision the server

Create a Hetzner instance with:

- **Type:** CX23 (2 vCPU x86, 4 GB RAM, 40 GB SSD)
- **OS:** Ubuntu 24.04 LTS
- **Location:** Nuremberg or Falkenstein
- **SSH key:** add yours

> **Warning.** Do **not** use the CAX series (ARM64). Baileys silently fails on ARM. See [`lessons-learned.md`](lessons-learned.md).

## Step 2 — Initial setup

```bash
ssh root@SERVER_IP
apt update && apt upgrade -y
apt install -y curl wget git nano ufw htop
```

## Step 3 — Configure the firewall

In the Hetzner Cloud Console, create a firewall with these rules:

| Direction | Protocol | Port | Purpose |
|---|---|---|---|
| Inbound | TCP | 22 | SSH |
| Inbound | TCP | 8080 | Evolution API (via tunnel) |
| Inbound | ICMP | — | Ping |
| Outbound | TCP | 5222 | WhatsApp WebSocket |
| Outbound | TCP | 80 | HTTP |
| Outbound | TCP | 443 | HTTPS |
| Outbound | TCP/UDP | 53 | DNS |
| **Outbound** | **UDP** | **7844** | **Cloudflare QUIC — required** |

The UDP 7844 rule is mandatory. Without it the tunnel reconnects forever silently.

## Step 4 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
docker --version
docker compose version
```

## Step 5 — Deploy the service stack

```bash
mkdir -p ~/evolution
cd ~/evolution
# Copy infrastructure/docker-compose.yml into this directory
# Edit the file to set strong passwords and your domain
docker compose up -d
docker compose ps
```

Generate strong secrets with:

```bash
openssl rand -hex 20    # for API keys
openssl rand -hex 32    # for JWT_SECRET
```

## Step 6 — Configure Cloudflare Tunnel

```bash
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | apt-key add -
echo 'deb https://pkg.cloudflare.com/ focal main' | tee /etc/apt/sources.list.d/cloudflare-main.list
apt update && apt install cloudflared -y

cloudflared tunnel login
cloudflared tunnel create mensagem-brasil
# Note the UUID

mkdir -p ~/.cloudflared
# Copy infrastructure/cloudflare-tunnel/config.yml.example to ~/.cloudflared/config.yml
# Edit it to set the UUID and credentials path

cloudflared tunnel route dns mensagem-brasil api.YOURDOMAIN.com
cloudflared tunnel route dns mensagem-brasil dashboard.YOURDOMAIN.com

cloudflared service install
systemctl start cloudflared
systemctl status cloudflared
```

In the Cloudflare dashboard, add a **Cache Rule** for the dashboard hostname with policy `Bypass cache`. Without this, JavaScript updates won't propagate to clients.

## Step 7 — Set up Node.js and the dashboard

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
pm2 startup
# Run the command pm2 prints

mkdir -p ~/dashboard
cd ~/dashboard
npm init -y
npm install express pg jsonwebtoken bcrypt helmet express-rate-limit nodemailer dotenv
# Copy examples/dashboard/* into this directory
# Create ~/dashboard/.env with secrets

pm2 start server.js --name dashboard
pm2 save
pm2 status
```

## Step 8 — Apply the database schema

```bash
docker exec -i evolution-postgres psql -U evolution -d evolution < database/schema.sql
```

## Step 9 — Set up daily backups

```bash
# Copy infrastructure/backup/backup.sh to ~/backup.sh
chmod +x ~/backup.sh
~/backup.sh   # test once
ls -lh ~/backups/

# Schedule daily at 02:00
crontab -e
# Add: 0 2 * * * /root/backup.sh >> /root/backups/backup.log 2>&1
```

## Step 10 — Configure Make scenarios

Three scenarios are required:

1. **Onboarding** (Webhook trigger) — receives the payment webhook from Kiwify, calls `POST /api/auth/criar-do-make` on the dashboard, sends a welcome email via Resend.
2. **Daily delivery** (Schedule, 06:00) — calls `GET /api/envio/envio-diario`, iterates contacts, calls GPT-4o for the message and DALL·E 3 for the image, sends via Evolution API, records via `POST /api/historico/registrar`.
3. **Disconnection alert** (Schedule, 06:05) — finds clients with `whatsapp_status != 'open'` and emails them.

## Step 11 — Set up monitoring

In UptimeRobot (free), add two HTTP(s) monitors at 5-minute intervals:

- `https://api.YOURDOMAIN.com`
- `https://dashboard.YOURDOMAIN.com`

Configure email alerts.

## Verification

After all steps, you should be able to:

- Open `https://api.YOURDOMAIN.com/manager` and see the Evolution API panel.
- Open `https://dashboard.YOURDOMAIN.com` and reach the dashboard.
- Run a test scenario in Make manually and observe a delivered WhatsApp message.
- Run `~/backup.sh` and find a `.sql.gz` in `~/backups/`.
- See both UptimeRobot monitors as `Up`.
