# Mensagem Brasil — Aplicação de LLM em Produção para Geração de Texto Personalizado via WhatsApp

> Plataforma SaaS multi-tenant que gera e entrega mensagens personalizadas diariamente no WhatsApp, usando GPT-4o (texto) e DALL·E 3 (imagem), com custo fixo de infraestrutura de **~US$3,50/mês**, independente do volume.

**Autores:** Luis Augusto Caetano · Valeria Vieira Santos
**Domínio:** PLN aplicado · Sistemas com LLMs · Geração controlada de texto · IA multimodal
**Ano:** 2026

📄 **English version:** [README.md](README.md)

---

## Resumo

Este repositório documenta o projeto, a implementação e o deploy em produção de uma **aplicação real com LLMs** que gera mensagens personalizadas em linguagem natural condicionadas a parâmetros por destinatário (nome, tom, tema) e as entrega via WhatsApp pessoal. O sistema é totalmente containerizado, roda em uma única instância x86 em nuvem e orquestra GPT-4o, DALL·E 3, o protocolo do WhatsApp e uma camada de automação no-code (Make).

A documentação está em duas formas:

1. **Guia técnico passo-a-passo** — todos os comandos, arquivos de configuração e decisões de design para reproduzir do zero ([PDF](docs/pdfs/guia-construcao-servidor-github.pdf)).
2. **Case técnico** — raciocínio arquitetural, trade-offs de infraestrutura e lições aprendidas no deploy ([PDF](docs/pdfs/case-tecnico-github.pdf)).

---

## Por que isso importa para Linguística Computacional / PLN

Apesar de ter sido construído como produto comercial, o sistema toca em vários pontos relevantes para pesquisa em PLN aplicado:

- **Geração controlada de texto:** condicionar a saída do LLM em uma tupla `(nome, tom, tema)` para produzir mensagens estilisticamente distintas mas semanticamente fiéis.
- **Engenharia de prompt como design de interface:** o prompt é o contrato entre regra de negócio e modelo — veja [`examples/prompts/message-generation.md`](examples/prompts/message-generation.md).
- **Pipelines de geração multimodal:** coordenar geração de texto (GPT-4o) e imagem (DALL·E 3) por mensagem, com condicionamento semântico compartilhado.
- **LLM em produção:** padrões de confiabilidade (retries, fallbacks, monitoramento) quando o LLM está no caminho crítico de uma SLA diária.
- **PLN para português brasileiro:** o sistema gera português idiomático em escala; escolhas de prompt importam para registro e naturalidade.

Direções de pesquisa em [`docs/research-directions.md`](docs/research-directions.md).

---

## Arquitetura

Veja o diagrama em [`images/architecture.svg`](images/architecture.svg) e a explicação em [`docs/architecture.md`](docs/architecture.md).

Componentes principais:

- **Compute:** Hetzner CX23 (x86) — ARM64 quebra silenciosamente o Baileys.
- **Containers:** Docker Compose orquestrando PostgreSQL 15, Redis 7 e Evolution API v2.
- **Edge:** Cloudflare Tunnel (sem expor IP, SSL automático).
- **Backend:** Node.js 20 + Express + PM2.
- **LLM texto:** GPT-4o.
- **LLM imagem:** DALL·E 3.
- **Orquestração:** Make (Integromat) — onboarding, envio diário, alertas.

---

## Quick Start

Instruções completas em [`docs/deployment-guide.md`](docs/deployment-guide.md). Em alto nível:

1. Provisionar Hetzner CX23 (x86, **nunca** CAX/ARM).
2. Configurar firewall — incluindo **UDP 7844 outbound** para o Cloudflare Tunnel.
3. `docker compose up -d` com [`infrastructure/docker-compose.yml`](infrastructure/docker-compose.yml).
4. Configurar Cloudflare Tunnel usando [`infrastructure/cloudflare-tunnel/config.yml.example`](infrastructure/cloudflare-tunnel/config.yml.example).
5. Aplicar schema em [`database/schema.sql`](database/schema.sql).
6. Subir o dashboard em [`examples/dashboard/`](examples/dashboard/) com PM2.
7. Configurar os três cenários no Make (onboarding, envio diário, alerta de WhatsApp desconectado).
8. Agendar [`infrastructure/backup/backup.sh`](infrastructure/backup/backup.sh) no cron.

---

## Resultados

| Métrica | Valor |
|---|---|
| Custo de infraestrutura | ~US$3,50/mês fixo |
| Custo por mensagem gerada | < US$0,001 (apenas tokens do LLM) |
| Onboarding (pagamento → primeiro login) | < 2 minutos |
| Tempo de restauração de backup | < 5 minutos |
| Uptime monitorado | 100% no período observado |

---

## Como citar

Veja [`CITATION.cff`](CITATION.cff) ou:

> Caetano, L. A., & Santos, V. V. (2026). *Mensagem Brasil — Aplicação de LLM em Produção para Geração de Texto Personalizado via WhatsApp.* Repositório GitHub.

---

## Licença

[MIT](LICENSE). PDFs em `docs/pdfs/` sob [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

---

## Autores

- **Luis Augusto Caetano** — arquitetura do sistema, backend, infraestrutura
- **Valeria Vieira Santos** — coautora, design de prompts e PLN, documentação, produto
