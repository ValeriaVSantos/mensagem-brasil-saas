# Prompt Engineering — Message Generation

This document records the production prompt used to generate daily WhatsApp messages and discusses the design choices.

## Production Prompt

```text
Você é um assistente que escreve mensagens de bom dia.
Escreva uma mensagem curta (2-3 frases) para {nome}.
Tom: {tom}. Tema preferido: {tema}.
A mensagem deve parecer escrita por uma pessoa real,
não por um sistema automatizado.
Não use emojis em excesso. Seja genuíno.
Não mencione que a mensagem foi gerada por IA.
```

**Slot fillers:**

| Slot | Type | Examples |
|---|---|---|
| `{nome}` | string (first name) | `Ana`, `Carlos`, `Mariana` |
| `{tom}` | enum | `carinhoso`, `motivacional`, `espiritual`, `divertido` |
| `{tema}` | enum or free text | `fé`, `família`, `trabalho`, `gratidão`, `geral` |

**Model:** OpenAI GPT-4o
**Temperature:** 0.7 in production
**Max tokens:** 200

## Design Choices

### Length constraint as a register signal

The "2-3 frases" instruction is intentionally restrictive. GPT-4o, like most modern LLMs, defaults to expansive responses that read as artificial in a WhatsApp message context. The length constraint is the single most important component of the prompt for register naturalness.

We tried softer phrasings ("seja conciso", "mantenha curto") and found them less effective than the explicit sentence-count constraint.

### Negative constraints to suppress AI tells

Two negative constraints address the most common artifacts of LLM-generated Portuguese:

1. `"Não use emojis em excesso"` — without this, GPT-4o tends to insert 2-4 emojis per short message, which reads as commercial / automated. With it, emoji use drops to 0-1 per message.
2. `"Não mencione que a mensagem foi gerada por IA"` — without this, the model occasionally inserts disclaimers like "como uma IA…" or "espero que esta mensagem te alegre". With it, those phrases disappear.

A potential research question is whether these constraints introduce *new* artifacts (overcorrection, register flattening). See [`docs/research-directions.md`](../../docs/research-directions.md) §2.

### Tone and theme as conditioning variables

`{tom}` is a stylistic variable; `{tema}` is a semantic variable. Decoupling them allows the same theme ("família") to be rendered in multiple registers ("carinhoso" vs "motivacional") without retraining. This is a lightweight form of controlled generation that works well for short-form output.

The enum is intentionally small. We experimented with allowing free-text tone descriptors but found them harder to evaluate and more prone to drift across days.

### Identity framing

`"Você é um assistente que escreve mensagens de bom dia"` is a minimal system-style framing inside the user prompt. We did not use the OpenAI `system` role for this content because the production prompt is concatenated programmatically and we preferred a single-role design for traceability.

## Failure Modes Observed in Production

| Failure | Frequency | Mitigation |
|---|---|---|
| Too long (>3 sentences) | Rare (<2%) | Post-generation truncation to first 3 sentences as a safety net. |
| Emoji-heavy despite constraint | Rare (<3%) | Acceptable; we do not regenerate. |
| Generic / boilerplate ("tenha um lindo dia!") | ~5% on the `geral` theme | Encouraging more specific themes per contact reduces this. |
| Register mismatch (formal when "carinhoso" requested) | ~1% | Acceptable. |
| Mentions "IA" or "assistente" | <1% with current prompt | Was higher before adding the negative constraint. |

## Ablation Sketch (Not Yet Run)

A useful research extension would be a controlled ablation:

```
                            | naturalness | tone fidelity | theme relevance
─────────────────────────────────────────────────────────────────────────
A. No constraints           |     ?       |       ?        |       ?
B. + length constraint      |     ?       |       ?        |       ?
C. + emoji constraint       |     ?       |       ?        |       ?
D. + AI-tell constraint     |     ?       |       ?        |       ?
E. All (production)         |     ?       |       ?        |       ?
```

Sample size guidance: 100 distinct `(nome, tom, tema)` tuples × 5 generations × 5 conditions = 2,500 outputs, double-annotated.

## Image Prompt (DALL·E 3)

The image is generated separately, using a derived prompt:

```text
Imagem minimalista, estilo aquarela suave, com tema "{tema}".
Sem texto, sem rostos identificáveis. Cores claras e harmoniosas.
Atmosfera tranquila, adequada para uma mensagem de bom dia.
```

This is intentionally generic — the image is a visual companion to the text, not a literal illustration. Specific iconography would require slot-aware visual generation, which is a larger project.

## Related Work (Informal)

The design draws on practitioner-level prompt-engineering patterns rather than a specific paper. Relevant academic context includes:

- **Controllable text generation** with control tokens (CTRL, GeDi) — though we use natural-language constraints, not learned control codes.
- **Prompting and instruction-following** — our negative constraints rely on the model's instruction-following ability, which is well-known to degrade in non-English settings (Bawden et al., 2023; Singh et al., 2024).
- **Persona-grounded dialogue** — `{tom}` is a lightweight version of the persona conditioning explored in PersonaChat-style work.

A more rigorous literature review would be the first step of the research extension proposed in [`docs/research-directions.md`](../../docs/research-directions.md).
