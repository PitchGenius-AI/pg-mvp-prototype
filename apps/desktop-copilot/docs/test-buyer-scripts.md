# Buyer test scripts (TTS playback)

Sample **buyer** turns to paste into a text-to-speech app and play as the buyer audio
(system output), so you can simulate calls end to end against the live co-pilot.
You speak the **seller** side into the mic; play one buyer line per turn.

## How to use

- The lifecycle is `PROMPT → PROCESSING → SUCCESS`. For each cue: **voice the seller
  question first** (the hero's trigger/example, in your own words) — that flips
  PROMPT→PROCESSING — then **play the buyer line** below — that scores the answer and
  advances to SUCCESS.
- The current discovery order is: **Break the ice → Why now? → How do they decide? →
  What's a win / what'd hold them back?** Then the planner flips to the generated live
  phase. So play the four discovery answers in order, then the live answers.
- Three archetypes below drive **different** matched techniques — run all three to
  watch the **Technique pill** flip (SPIN → Challenger → NEPQ) and the **Buyer pill**
  firm up differently each time.
- Playback: use **headphones** (so the buyer audio doesn't bleed into your mic). The
  buyer tap anchors to the **default system output device** — if the Buyer transcript
  stays empty, check System Settings → Sound → Output.
- **⚡ lines are optional material-signal triggers (B1 — §5.3).** Each scenario's Live
  phase ends with four ⚡ lines (objection / buying signal / new stakeholder / pricing),
  written in that buyer's voice. Play any one **in place of a live answer** to fire a
  re-plan: the overlay shows a brief amber **"re-planning"** beat and the next cue is
  shaped by the signal. They're optional and order-free — splice in whichever you want
  to see. In the **live** phase a signal always fires; **mid-discovery** it only fires
  once ≥2 discovery answers are scored (else it's held so the read isn't stranded), and
  when it does fire it flips the call to the live phase — so to test the guard, play a
  ⚡ line right after **Break the ice** (held) vs. after question 3 (fires + flips).

---

## Scenario A — Steady / analytical consensus buyer → should match **SPIN**

Warm, methodical, risk-averse, decides by consensus. (This is the canonical demo read.)

**1. Break the ice**
> Sure. I head up revenue operations here — been with the company about three years. I'm pretty hands-on; I like to really understand how something works before we commit. Right now I'm focused on getting our newer reps ramped without burning the team out.

**2. Why now?**
> Honestly, it's been building for a while. Our process is mostly manual and it's starting to crack as we grow. We lost a couple of deals last quarter to slow follow-up, and I don't want that to become the norm.

**3. How do they decide? Who's in?**
> It'd be a group decision. I'd lead it, but our COO has to sign off on anything significant, and I'd want my ops folks bought in before we move — they're the ones living in the tool every day.

**4. What's a win? What'd hold them back?**
> A win is reps getting productive in days instead of weeks, with a lot less manual cleanup. What gives me pause is adoption — we've bought tools before that nobody ended up using, and I really don't want to repeat that.

**Live phase**
> If I'm honest, the lost productivity is probably costing us three or four hires worth of output a year.

> I'd want to see how this actually works with our data before I could take it to the COO.

_⚡ Optional re-plan triggers (play in place of a live answer):_
> ⚡ **objection** — I have to be honest, I'm not sure the price is really justified for what we'd realistically use day to day.

> ⚡ **buying signal** — Okay, say we liked it — what would getting started actually involve, and how soon could we realistically be live?

> ⚡ **new stakeholder** — I should mention, our new CFO started last month, and she'll want to weigh in on anything at this level.

> ⚡ **pricing** — Before we go much further, I'd want to understand what something like this actually costs.

---

## Scenario B — Dominant / decisive, open exec → should match **Challenger**

Blunt, time-pressured, opinionated, open to a strong point of view.

**1. Break the ice**
> I'm the VP of Sales. Let's keep this tight — I've got about twenty minutes. Tell me what you've got and I'll tell you if it's interesting.

**2. Why now?**
> We're scaling fast and the old way isn't keeping up. I don't have time for incremental — if we're going to change something, I want it to actually move the needle.

**3. How do they decide? Who's in?**
> It's my call. I loop people in, but I move fast — I don't do six-month committees. If it's right, we'll do it.

**4. What's a win? What'd hold them back?**
> A win is a step-change in how fast my team closes. My worry is that this is just another dashboard — show me something I'm not already seeing.

**Live phase**
> Alright, that's a sharper take than I expected. Keep going.

> If you were in my seat, what would you actually do here — what's the move?

_⚡ Optional re-plan triggers (play in place of a live answer):_
> ⚡ **objection** — I'm not sold the price matches the value here. Convince me it's worth it.

> ⚡ **buying signal** — Alright — what's it take to get going, and how fast can we be live?

> ⚡ **new stakeholder** — My CFO's going to want in on a number like this. He doesn't rubber-stamp anything.

> ⚡ **pricing** — Cut to it — what does this actually cost?

---

## Scenario C — Guarded / skeptical buyer → should match **NEPQ**

Reserved, low trust, high sales resistance, anxious about disruption.

**1. Break the ice**
> Not much to say, really. I run the ops team. I'll be honest — I've sat through a lot of these and they tend to sound the same, so I'm coming in a bit skeptical.

**2. Why now?**
> My boss asked me to look into it, to be honest. I'm not convinced we have a problem that needs a new tool — change is disruptive, and our last rollout was painful.

**3. How do they decide? Who's in?**
> I'd have to be really sure before I brought this to anyone. I don't like sticking my neck out on something unproven.

**4. What's a win? What'd hold them back?**
> What would actually worry me is the disruption. If this turns into another six-month project that pulls the team off their work, that's a problem. I need to know it won't blow up in my face.

**Live phase**
> I'm still not sure this is really for us, honestly.

> What makes you think this would even work in an environment like ours?

_⚡ Optional re-plan triggers (play in place of a live answer):_
> ⚡ **objection** — Honestly, I'm not sure the price is worth it for how little we'd probably end up using it.

> ⚡ **buying signal** — I mean… if we did go ahead, what would getting started even involve, and how long would it take?

> ⚡ **new stakeholder** — I'd have to bring in our CFO before anything like this — she's careful with this kind of spend.

> ⚡ **pricing** — Before we keep going, what are we actually talking about cost-wise?

---

## Material-signal reference (B1 — §5.3)

The ⚡ lines above are now baked into each scenario's Live phase. For reference, each
label re-plans the chain toward:

| ⚡ Label | Re-plans toward | Amber beat |
| --- | --- | --- |
| **objection** | reframe / handle the concern | "Caught an objection — re-planning to handle it" |
| **buying signal** | trial close / advance | "Buying signal — re-planning to advance" |
| **new stakeholder** | decision process / multi-thread | "New stakeholder — re-planning the decision map" |
| **pricing** | value / commercial (cost-of-inaction first) | "Pricing raised — re-planning toward value" |

Classification is one field on the existing buyer-score haiku call (no extra latency),
independent of whether the turn "answers" the cue — so a ⚡ buying/pricing *question*
re-plans even though it doesn't answer. Watch the terminal for `signal {label}` →
`force re-plan` → `replan …ms · …`.

---

## Non-answers (should NOT advance the cue)

These are filler / deflection — the scorer should mark them "not an answer" and the cue
should **stay in PROCESSING** (waiting for a real reply). Use them to confirm a
backchannel doesn't falsely advance the lifecycle:

- "Mm-hmm."
- "Right, right — go on."
- "Sorry, what do you mean by that?"
- "Hang on, let me grab a pen."
