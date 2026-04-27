# Research Directions

This document outlines NLP and computational-linguistics questions surfaced by Mensagem Brasil that could become research projects in their own right. The system is a working production artifact, but several of its design decisions are research-flavored: they were made under constraints, with limited evaluation, and with no comparison to literature.

## 1. Controllable text generation under hard length and register constraints

**Question.** How well does GPT-4o respect tuple-conditioned constraints `(name, tone, theme)` in short-form Brazilian Portuguese, and how stable is the output across temperature settings, time of day (model drift), and prompt revisions?

**Why it matters.** The literature on controllable text generation focuses heavily on English, on long-form content, or on synthetic benchmarks. Production deployments of LLMs for personalized short-form messaging in non-English languages are under-studied.

**Possible study design.**
- Define a small held-out set of 100 `(name, tone, theme)` tuples.
- Generate 10 outputs per tuple per condition (temperature ∈ {0.3, 0.7, 1.0}; with vs. without negative constraints).
- Human-rate on three axes: tone fidelity, theme relevance, perceived naturalness (vs. AI-tells).
- Report inter-rater agreement and effect sizes.

## 2. Negative constraints as artifact suppression in Portuguese LLM output

**Question.** The production prompt includes `"não use emojis em excesso"` and `"não mencione que a mensagem foi gerada por IA"`. Do these negative constraints actually reduce known LLM artifacts in BP, or do they create new ones (e.g., overcorrection, register flattening)?

**Why it matters.** Practitioner lore says negative constraints "work." Research findings on instruction-following in multilingual LLMs are mixed. A controlled ablation in BP would be useful to the community.

**Possible study design.**
- Four prompt variants: (a) no constraints, (b) emoji constraint only, (c) AI-tell constraint only, (d) both.
- Annotate outputs for emoji density, hedging language ("como uma IA…"), and stylistic register.
- Compare distributions, not just means.

## 3. Multimodal coherence: text–image semantic alignment

**Question.** When GPT-4o generates a message and DALL·E 3 generates an image conditioned on the same `tema`, how often is the resulting pair semantically coherent to a human reader? When it fails, what kind of failure dominates (object drift, register mismatch, cultural mismatch)?

**Why it matters.** Most multimodal-coherence work uses English captions and Western-default images. BP messaging with culturally-grounded themes (e.g., `"fé"`, `"família"`, `"trabalho"`) is a useful stress test.

**Possible study design.**
- Sample 500 production text–image pairs.
- Two annotators independently judge coherence on a 5-point scale.
- Cluster failure cases qualitatively and report a typology.

## 4. Production reliability of LLMs on the hot path

**Question.** What does the long-tail latency distribution of GPT-4o calls look like under real production conditions over a 90-day window? What retry strategy minimizes user-visible failures without exploding cost?

**Why it matters.** Most LLM-eval work measures throughput in benchmark conditions. SLA-bound deployments need different metrics.

**Possible study design.**
- Log every OpenAI call with `(start_time, end_time, status, retries, tokens)`.
- Build a survival curve over 90 days.
- Compare retry policies via simulation against the historical trace.

## 5. Onboarding-time UX of LLM-generated content

**Question.** Customers configure their own contacts and choose tones. When a customer first sees the *generated* message, how does that initial reaction predict 30-day retention?

**Why it matters.** This is a real product question with research methods (cohort analysis, mixed-effects modeling). It also intersects with user-modeling literature in HCI.

## 6. Replacing Make with a fully-coded orchestrator

**Engineering question, not research.** Make is convenient but expensive at scale, and the trace is hard to reason about programmatically. Reimplementing the daily-delivery pipeline in Temporal or Prefect would yield: (a) better observability, (b) typed inputs, (c) a single source of truth in version control, (d) lower fixed cost. This is a strong portfolio piece for a CL/NLP candidate to demonstrate end-to-end systems thinking.

---

If you want to pursue any of these, the production data (anonymized) would be available under collaboration. Open an issue or contact the authors.
