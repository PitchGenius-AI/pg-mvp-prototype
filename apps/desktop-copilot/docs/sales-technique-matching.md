# Sales Technique Matching — SPIN / Challenger / NEPQ

> Companion to [UX_SPEC.md](UX_SPEC.md). The **authoritative in-repo encoding of the client's
> source-of-truth guide** — _PitchGenius AI Sales Technique Matching Roadmap_
> ([Drive PDF](https://drive.google.com/file/d/1BwNr1ZPGTNkCA4DQqTB__4ugFJ7jUnes/view)). When this
> doc and the PDF disagree, the PDF wins and this doc should be corrected. Referenced from
> UX_SPEC §1, §5.3/§5.4 (Technique pill), §6.
>
> **2026-06-16 — rewritten to match the official guide.** The previous version was a qualitative
> DISC/OCEAN→technique table with no scoring formula, no secondary technique, no archetypes, no
> hybrids, and a contradiction (it claimed low-Agreeableness leans NEPQ; the guide makes NEPQ the
> **high-Agreeableness** "Trust-First Buyer"). All of that is corrected below.

## 1. Core objective

Given a buyer's **DISC + OCEAN** profile, choose the sales technique most likely to **create
trust, reduce resistance, and move the buyer toward a decision**. The system chooses among:

- **Challenger** — best when the buyer respects insight, strength, strategic reframing, and proof.
- **SPIN** — best when the buyer needs structured discovery, logical progression, risk clarity.
- **NEPQ** — best when the buyer needs emotional safety, low-pressure questioning, self-persuasion.

It outputs a **primary** technique, a **secondary** (support) technique, a **buyer archetype**, a
**confidence score**, and copy/opening guidance (§9). Matching is deterministic from the scores
(§5); the buyer profile is the only input.

## 2. Personality inputs

Each scored **0–100**.

| DISC | Meaning | | OCEAN | Meaning |
| --- | --- | --- | --- | --- |
| **D** Dominance | speed, control, outcomes | | **O** Openness | innovation, abstract thinking, novelty |
| **I** Influence | social energy, enthusiasm, persuasion | | **Cn** Conscientiousness | structure, discipline, detail |
| **S** Steadiness | safety, trust, consistency | | **E** Extraversion | social energy, assertiveness |
| **C** Conscientiousness (DISC) | logic, accuracy, proof | | **A** Agreeableness | collaboration, warmth, harmony |
| | | | **N** Neuroticism | sensitivity to risk, fear, uncertainty |

> Note the two "conscientiousness" axes: **DISC-C** (`C_disc`, logic/proof) and **OCEAN-Cn**
> (structure/detail) are **distinct inputs** and both feed the formula.

## 3. The three techniques

### Challenger — "The Strategic Skeptic"

Assertive, insight-led: **Teach** a reframe, **Tailor** to the stakeholder, **Take control** with
constructive tension on price/timeline/status-quo. The buyer wants directness, evidence, insight,
expertise, a strong point of view, strategic advantage. Best for CTOs, CEOs, founders, VPs of
Sales, CFOs, operators, technical/sophisticated buyers. They don't want to be comforted first —
they want to be taught something useful: _"Here's what the market is missing, here's why the old
way is flawed, here's the smarter way forward."_

### SPIN — "The Structured Evaluator"

Consultative, question-led: **Situation → Problem → Implication → Need-payoff**. The buyer wants
clarity, logical steps, evidence, problem diagnosis, reduced uncertainty, a clean business case.
Best for sales enablement, RevOps, operations, procurement, HR, finance, implementation leads,
process-driven managers. They don't want to be pushed — they want to think the problem through:
_"Let's clarify the situation, identify the real problem, understand the consequences, and define
the value of solving it."_

### NEPQ — "The Trust-First Buyer"

Neutral-tone, emotionally-engaged, low-resistance questioning: connection → situation →
problem-awareness → solution-awareness → consequence. The buyer wants safety, rapport, emotional
validation, control, low pressure, permission to explore. Best for relationship-driven founders,
SMB owners, HR leaders, customer-success leaders, coaches, service-based buyers, non-technical
operators. They don't want to be challenged too early — they need to feel safe enough to tell the
truth: _"Can I ask a few questions to understand what's really going on, so you can decide whether
this even makes sense?"_

## 4. Fit signals (qualitative — the formula in §5 is operative)

| Technique | Leans toward (ideal) |
| --- | --- |
| **Challenger** | DISC-D high · DISC-C med–high/high · OCEAN-O high · OCEAN-Cn high · OCEAN-N low–moderate · OCEAN-A low–moderate |
| **SPIN** | DISC-C high · DISC-S med–high · DISC-D low–moderate · OCEAN-Cn high · OCEAN-N moderate · OCEAN-A moderate · OCEAN-O moderate |
| **NEPQ** | DISC-S high · DISC-I med–high · DISC-D low–moderate · OCEAN-A high · OCEAN-N moderate–high · OCEAN-E moderate–high · OCEAN-Cn low–moderate |

## 5. Scoring formula (operative)

Normalize every input to 0–1 (`D = DISC_D / 100`, … `N = OCEAN_N / 100`). Then:

```
Challenger = 0.25·D + 0.20·C_disc + 0.20·O + 0.20·Cn + 0.10·(1 − N) + 0.05·(1 − A)
SPIN       = 0.25·C_disc + 0.20·S + 0.25·Cn + 0.10·A + 0.10·N + 0.10·(1 − D)
NEPQ       = 0.25·S + 0.20·I + 0.25·A + 0.15·N + 0.10·E + 0.05·(1 − D)
```

- **Primary technique** = highest score. **Secondary** = second-highest.
- Weigh **all** present signals — real buyers are composites; never branch on a single letter.

> **Watch-outs the old code/spec got wrong:** Influence (**I**) contributes to **NEPQ**, not
> Challenger. Agreeableness (**A**) high → **NEPQ/SPIN** (NEPQ's `0.25·A` is its largest term);
> low-A only weakly nudges Challenger via `0.05·(1−A)`. Conscientiousness feeds **both** Challenger
> (`+0.20·Cn`, `+0.20·C_disc`) **and** SPIN — it is not SPIN-only.

## 6. Confidence score

```
confidence_gap = primary_score − secondary_score
```

| Gap | Band |
| --- | --- |
| 0.00 – 0.05 | **Low** |
| 0.06 – 0.12 | **Medium** |
| ≥ 0.13 | **High** |

**If confidence is Low, output a hybrid** (§7) — start in the secondary's register, move into the
primary's. Example: primary SPIN, secondary NEPQ, Low → _"Start with NEPQ tone, then move into
SPIN structure."_

> _Guide inconsistency, flagged:_ the §9 example shows `confidence_score: 0.84`, which reads like a
> raw primary score, while §10 of the guide defines confidence as the **gap**. We follow §10 (the
> explicit "Confidence Score Logic" section): `confidence_score` is the gap, and we also surface the
> band. Revisit if the client clarifies.

**Live overlay reconciliation:** the desktop Technique pill shows a **Suggested → Recommended →
Locked** tier (§5.3/§5.4) that *firms over the call* as buyer speech accumulates. That live tier is
driven by this gap: as more is known, the gap stabilizes — Low→Suggested, Medium→Recommended,
High→Locked. The gap-band is the static read; the tier is its progressive-confidence display.

## 7. Hybrid outputs

When confidence is Low, combine primary + secondary:

| Combo (primary + secondary) | Output style | Best structure |
| --- | --- | --- |
| **Challenger + SPIN** | Technical Challenger | 1. Lead with insight · 2. Reframe the assumption · 3. Precision diagnostic Qs · 4. Show the mechanics · 5. Close with ROI logic |
| **SPIN + Challenger** | Consultative Analyst | 1. Current situation · 2. Diagnose the problem · 3. Quantify impact · 4. Introduce the reframe · 5. Propose next step |
| **NEPQ + SPIN** | Empathetic Diagnostic | 1. Permission-based opening · 2. Emotional safety · 3. Problem discovery · 4. Implication Qs · 5. Buyer-led realization |
| **NEPQ + Challenger** | Soft Challenger | 1. Permission · 2. Empathy · 3. Gentle reframe · 4. Buyer-led reflection · 5. Low-pressure next step |

(For the two pairs the guide doesn't name explicitly — Challenger+NEPQ, SPIN+NEPQ — use the
nearest style above: Challenger+NEPQ → Soft Challenger framing; SPIN+NEPQ → "logic + safety," the
§10 decision-tree step 6 combination.)

## 8. Buyer archetype map

| DISC + OCEAN pattern | Archetype | Primary | Secondary |
| --- | --- | --- | --- |
| High D + High C + High O + High Cn + Low N | **Strategic Skeptic** | Challenger | SPIN |
| High C + High S + High Cn + Moderate N | **Structured Evaluator** | SPIN | Challenger |
| High S + High A + Moderate/High N | **Trust-First Buyer** | NEPQ | SPIN |
| High I + High A + High E | **Relationship Persuader** | NEPQ | Challenger |
| High D + Low A + High O | **Power Buyer** | Challenger | NEPQ-lite |
| High C + Low O + High Cn | **Risk Controller** | SPIN | NEPQ |
| High S + Low O + High A | **Stability Seeker** | NEPQ | SPIN |
| High D + High I + High O | **Visionary Driver** | Challenger | NEPQ |
| High C + High N + High Cn | **Anxious Analyst** | SPIN | NEPQ |
| High I + High S + High A | **Warm Collaborator** | NEPQ | SPIN |

The archetype is a label for the composite; when no pattern fits cleanly, pick the best-fit by the
formula's primary/secondary and the dominant traits.

## 9. Required output (per lead)

```json
{
  "primary_sales_technique": "Challenger",
  "secondary_sales_technique": "SPIN",
  "buyer_archetype": "Strategic Skeptic",
  "confidence_score": 0.14,
  "reasoning_summary": "Buyer shows high dominance, high conscientiousness, high openness, and low emotional volatility. Best approached with insight, evidence, and technical reframing.",
  "recommended_opening_style": "Direct, insight-led, technical",
  "avoid": ["soft rapport-heavy opening", "generic benefits", "unsupported claims"],
  "best_question_type": "diagnostic challenge question",
  "recommended_next_step": "7-minute architecture walkthrough"
}
```

Deterministic fields (`primary`/`secondary`/`archetype`/`confidence_score`/`recommended_opening_
style`/`avoid`/`best_question_type`) come from §5–§8 + §10. `reasoning_summary` and
`recommended_next_step` are buyer-/context-specific and produced by the pre-call chain.

## 10. Copy generation rules (per primary technique)

| | Tone | Opening style | Best question type | Use phrases | Avoid |
| --- | --- | --- | --- | --- | --- |
| **Challenger** | direct, precise, intellectually confident, insight-heavy | Direct, insight-led, technical | diagnostic challenge question | "The hidden issue is…" · "Most teams miss this…" · "The old model assumes…" · "The real leverage point is…" · "Here is the logic chain…" | "Just checking in" · "Would love to connect" · "I'd love to tell you more" · "Hope you're doing well" |
| **SPIN** | structured, diagnostic, consultative, calm | Structured, situation-first | situation / problem / implication question | "How are you currently handling…?" · "Where does this usually break down?" · "What happens when that continues?" · "How are you measuring the impact?" · "Would solving that change how your team operates?" | aggressive claims · abstract vision · fast closes · overly emotional language |
| **NEPQ** | permission-based, emotionally safe, curious, low pressure | Permission-based, low-pressure | permission-based discovery question | "Would it be okay if…" · "I'm curious…" · "What have you tried so far?" · "How has that affected the team?" · "Do you feel like that's worth solving?" | hard challenges · technical overload · pressure closes · proving too early |

## 11. Developer decision tree (sanity cross-check on §5)

1. High D + High O + High Cn → **Challenger** likely.
2. High C + High S + High Cn → **SPIN** likely.
3. High S + High A + Moderate/High N → **NEPQ** likely.
4. Two techniques close (Low gap) → **hybrid** (§7).
5. High D + High N → avoid aggressive Challenger; use **Soft Challenger**.
6. High C + High N → **SPIN + NEPQ** (logic + safety).
7. High I + High A → **NEPQ** (connection + comfort).
8. High D + Low A → **Challenger** (direct, evidence-based).

## 12. Worked examples (from the guide)

- **Decisive, skeptical, unflappable exec** (high-D, low-A, low-N): Challenger primary, NEPQ
  secondary. High gap ⇒ **High** confidence, no hybrid.
- **Careful, analytical, risk-averse buyer** (high-S, high-Cn, high-N): SPIN primary, NEPQ
  secondary, Challenger suppressed.
- **Enthusiastic, idea-driven buyer** (high-I, high-O): Challenger _Teach_ delivered warmly, light
  SPIN to ground it.

## 13. Build phases (from the guide)

1. **Rule-based matching** — the §5 scoring engine: DISC/OCEAN in → primary, secondary, archetype,
   confidence out. (Canonical implementation lives in `@pg/shared`; the desktop Rust planner
   mirrors it — both must match this doc.)
2. **Prompt layer** — per-technique templates (LinkedIn DM, cold email, call opener, discovery
   questions, objection handling, follow-up, live-call prompt) grounded in §10.
3. **Feedback loop** — record outcomes (reply rate, meeting booked, stage advanced, won/lost),
   then adjust weights. _Out of MVP scope_ (no Sales-Brain learning loop, per CLAUDE.md).
4. **Adaptive learning** — _post-MVP._
