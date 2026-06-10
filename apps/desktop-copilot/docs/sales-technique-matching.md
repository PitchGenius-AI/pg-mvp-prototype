# Sales Technique Matching — SPIN / Challenger / NEPQ

> Companion to [UX_SPEC.md](UX_SPEC.md). Source-of-truth definitions for the three MVP
> sales techniques and the first-pass mapping from a psychological profile (DISC / OCEAN)
> to a recommended technique. Referenced from UX_SPEC §1, §4.5, §6.

## Purpose

This document closes an open question raised during prototyping: where the source-of-truth
definitions for the sales techniques live, and how a buyer's psychological profile maps to
a recommended technique. It does two things:

1. **Defines the three MVP techniques** — SPIN, Challenger, NEPQ — in neutral terms the
   engine and the dev team can build against.
2. **Proposes a first-pass mapping** from DISC / OCEAN traits to a leaning technique, with
   the reasoning behind each.

These are **starting defaults, not fixed rules.** They set the base weights the
technique-matching engine begins from. The engine still combines profile confidence and
technique confidence, adjusts mid-call, and surfaces a technique as **Suggested /
Recommended / Locked** based on how strong the evidence is. A clean prior here makes that
scoring meaningful instead of arbitrary.

## The three techniques

### SPIN

A consultative, question-led method. The rep moves through four question types in
sequence: **Situation** (facts about the buyer's current state), **Problem** (difficulties
and dissatisfactions), **Implication** (the cost and ripple effects of those problems), and
**Need-payoff** (getting the buyer to articulate the value of solving them). Low-pressure,
methodical, buyer-led. The seller builds the case through logic rather than pushing.

- **Optimizes for:** trust, thoroughness, and a buyer who reasons their way to a decision.
- **Best fit:** analytical, risk-averse, or relationship-cautious buyers; complex or
  longer-cycle deals.

### Challenger

An assertive, insight-led method built on three moves: **Teach** the buyer something new
that reframes how they see their problem, **Tailor** that message to the specific
stakeholder, and **Take Control** of the conversation — comfortable with constructive
tension on price, timeline, and status quo. The seller leads with a point of view rather
than asking permission.

- **Optimizes for:** reframing the buyer's thinking and creating urgency against the status
  quo.
- **Best fit:** buyers open to new ideas, time-pressured decision-makers, or accounts stuck
  in inertia.

### NEPQ

A question-led method emphasizing emotional engagement and lowered sales resistance.
Neutral tone and genuine curiosity are central. The rep moves through **connection,
situation, problem-awareness, solution-awareness, and consequence** questions designed to
let the prospect surface their own reasons to act, rather than being pushed.

- **Optimizes for:** defusing skepticism and getting the buyer to persuade themselves.
- **Best fit:** skeptical or guarded buyers, anyone with high sales resistance, or
  commoditized categories where buyers expect to be "sold to."

## Mapping: DISC trait → leaning technique

Base leanings per dominant trait. Real buyers are composites; the engine weighs all present
signals rather than reading a single letter.

| DISC trait | Leans toward | Why |
| --- | --- | --- |
| **D — Dominance** (direct, decisive, time-pressured) | Challenger (primary), NEPQ (secondary) | Respects a strong point of view and directness; tolerates tension. Slow, exhaustive discovery tends to frustrate. |
| **I — Influence** (social, optimistic, idea-driven) | Challenger *Teach*, framed conversationally | Engaged by big ideas and rapport; responds to insight delivered warmly. Less patience for long problem questioning. |
| **S — Steadiness** (patient, loyal, risk-averse) | SPIN (primary), NEPQ (secondary) | Values trust and a no-pressure pace; methodical buyer-led discovery fits. Challenger tension can alienate. |
| **C — Conscientiousness** (analytical, skeptical, detail-driven) | SPIN (primary), NEPQ for skepticism | Decides on evidence; the implication / need-payoff logic builds the case. Bring real data if challenging. |

## Mapping: OCEAN trait → leaning technique

| OCEAN trait | High end leans toward | Low end leans toward |
| --- | --- | --- |
| **Openness** | Challenger — receptive to reframing and novel insight | SPIN / NEPQ — less disruptive, incremental |
| **Conscientiousness** | SPIN — structured, logical case-building | Lighter discovery; lead with the headline |
| **Extraversion** | Tolerates Challenger assertiveness and tension | NEPQ / SPIN — gentler, lower-key |
| **Agreeableness** | SPIN / NEPQ — collaborative, trust-first | NEPQ — neutral tone to lower resistance |
| **Neuroticism** | NEPQ / SPIN — low-pressure, reassurance | Can handle directness; Challenger viable |

## Worked examples (composite profiles)

To show how the priors combine:

- **Decisive, skeptical, unflappable exec** (high-D, low-Agreeableness, low-Neuroticism):
  Challenger lead to match directness, with NEPQ questioning to absorb the skepticism.
  Likely surfaces as **Recommended** when profile confidence is high.
- **Careful, analytical, risk-averse buyer** (high-S, high-Conscientiousness,
  high-Neuroticism): SPIN lead, NEPQ secondary, Challenger suppressed — the tension works
  against you here.
- **Enthusiastic, idea-driven buyer** (high-I, high-Openness): Challenger *Teach* delivered
  warmly, with light SPIN to ground it. Rapport carries more weight than exhaustive
  discovery.
