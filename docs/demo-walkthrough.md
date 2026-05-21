# Pitch Genius demo walkthrough

Use this script when presenting the Buyer Readiness MVP prototype to a client. Follow the steps in order — the seed data is tuned so each step has a moment that lands.

> **Setup before the call:** run `pnpm dev` and open <http://localhost:5173> in a clean Chrome profile (so you start logged out). If the seed has drifted, hard-reload the page to re-hydrate from `apps/web/src/mock/seed.ts`.

---

## 1. Sign up + onboarding (~3 minutes)

**What to say:**
> "Pitch Genius is buyer-readiness intelligence for individual sales reps. Let me walk you through what a brand-new user experiences from the very first screen."

**Steps:**
1. Land on `/login` → click **Sign up**.
2. **Create account:** enter a name, a fresh email, and a password (8+ characters with a letter and a number). Inline validation fires on blur — to show it off, try `casey@acmesales.co` (reads as already registered) or a 3-character password.
3. The 10-step onboarding wizard opens. Step through it:
   - **Workspace name** — "Acme Sales Co".
   - **Website** — paste any URL and click **Analyze my website**. Watch the "Reading your website…" animation; it pre-fills the next four steps. (To demo the fallback instead, use a URL containing the word `fail` — the scrape "can't read" the site and steps 4–7 switch to blank manual entry. The **Skip** link does the same.)
   - **Industry / Products / Customer / Problem** — pre-filled from the scrape. Talk through editing the product list and marking a **primary** product; every readiness diagnosis is anchored to this product context.
   - **Call script** — paste a script, upload a file, or click **I don't have a script**.
   - **CRM** — pick HubSpot or Pipedrive (None / Other degrade export to copy-ready notes).
   - **Pipeline stages** — pick **Simple B2B Sales**.
4. Click **Finish setup**. You land in the app on a fresh, empty workspace.

**Talking points:**
- "Account to a configured workspace in a couple of minutes — and the website scrape means the rep confirms rather than types."
- "The flow adapts: a thin or missing website just drops the rep into manual entry, no dead ends."

> **For the rest of the demo** you want the pre-loaded pipeline. Sign out, then **Sign in** (any email + password) — that loads the seeded demo workspace with ten deals.

---

## 2. Add an opportunity — three intake methods (~3 minutes)

The Pitch Genius value prop is that capturing buyer evidence has to feel effortless. Show all three intake methods so the audience sees the breadth — but spend most of the time on Quick Paste (the marquee one).

**Steps:**
1. Click **Add opportunity** at the top right of the list.
2. Toggle through the three tabs and talk briefly:
   - **Structured form** — "for the rep who already knows the shape of the deal."
   - **Quick paste** — "paste your meeting notes, AI parses out the buyer + opportunity fields, you review and confirm." Walk through pasting a short paragraph; show the fake-AI animation; let it land on the review screen; cancel without saving.
   - **CSV upload** — "for migrating an existing pipeline; AI suggests column mappings with confidence indicators, you approve before insert." Skip the actual upload unless the audience asks.
3. Close the modal — you already have eight seeded deals to work from.

**Talking points:**
- "We do not replace your CRM. We sit alongside it, ingest the same evidence your reps already produce, and surface diagnoses your CRM cannot."

---

## 3. Filter the pipeline — surface the over-projecting deals (~30 seconds)

This is the setup for the punchline. The whole point of Pipeline Reality Check is that *some deals are not where the CRM says they are*.

**Steps:**
1. On the opportunity list, in the **Alignment** filter, select **Over-projecting**.
2. The list narrows to four deals: **Globex (critical)**, **Initech (high)**, **Soylent (high)**, and **Pied Piper (low)**.
3. Hover the at-risk icon on Globex, Initech, and Soylent — flagged because the buyer evidence is dominated by risk signals.

**Talking points:**
- "Four of ten deals in this pipeline are over-projecting. That's the kind of forecast surprise that costs a quarter."
- "Notice we are not telling the rep their deal is dead — we are telling them the *stage they have it at* is ahead of what the buyer evidence supports."

---

## 4. Land the Pipeline Reality Check on the Globex deal (~2 minutes — THIS IS THE PUNCHLINE)

**Steps:**
1. Open **Globex – CDP replacement Q2** (the critical over-projection).
2. The detail page lands on the **Overview** tab. Briefly point out: CRM stage = Negotiation, buyer state = Problem Aware, score 28/100. "Five readiness stages of gap."
3. Click into the **Diagnosis** tab.
4. The **Pipeline Reality Check** callout is the moment of value. Sit on it. Read the framing aloud:
   > "CRM Negotiation implies commitment readiness, but evidence shows the buyer has not aligned the team, discussed budget, or agreed a next step. Five readiness stages of gap."
5. Walk down the dimension scores: pain 45, urgency 30, commitment 10 (this is where the bottom drops out).
6. Read the **Primary blocker** — and the **Recommended next action**. Emphasize: "Stop sending pricing. Re-qualify."

**Talking points:**
- "This is the artifact that does not exist today. The CRM tells you what stage the rep *said* the deal is at. The Pipeline Reality Check tells you what stage the *buyer* is at."
- "If a manager sees this on a Monday morning, the conversation with the rep is now possible. Without it, they're flying blind."

---

## 5. Tour all 5 tabs on the same deal (~3 minutes)

Now you've sold the headline. Use Globex (still loaded) to walk through what the rest of the product looks like.

**Steps:**
1. **Overview** — buyer + opportunity cards, denormalized readiness state, activity timeline. If the deal has multiple interactions with diagnoses, the readiness trend bar shows progression (see step 7 for that demo).
2. **Evidence** — interactions list with checklist signals. Each interaction card shows the readiness state it produced. Click **Add interaction** to show the form (but don't run a diagnosis here — keep momentum).
3. **Diagnosis** — already shown in step 4. Scroll down past the Pipeline Reality Check to show signal cards (Observed Evidence / AI Inference / Missing Evidence sections), the **What not to do yet** card, the **Follow-up email** (copy-to-clipboard), and the **Manager coaching note**.
4. **Outcome** — pre-built to capture what happened after the recommended action. Walk through the outcome types briefly.
5. **Export** — CRM note (copy-to-clipboard), CSV download, JSON download. "Drop this straight into your CRM activity log."

**Talking points:**
- "Every artifact on this page is generated from the same buyer evidence. No double-entry from the rep."
- "The follow-up email isn't a generic template — it adapts to the readiness state and alignment outcome. A buyer at Problem Aware gets a different email than a buyer at Commit Ready."

---

## 6. Record an outcome (~1 minute)

Show that outcomes feed back into the deal so the manager can see what actually happened.

**Steps:**
1. Stay on the Globex detail. Click into the **Outcome** tab.
2. Select an outcome type (e.g. "stakeholder added" or "deal advanced"), add a note, save.
3. Watch the outcome appear in the outcomes list with a timestamp.
4. Navigate back to the Overview — note the activity timeline now reflects the new outcome.

**Talking points:**
- "Outcomes are recorded but in the MVP they don't feed back into prompt updates. That's the Sales Brain loop — explicitly post-MVP."

---

## 7. Show readiness progression on a multi-interaction deal (~1 minute)

This is a deeper second example. Pick **Massive Dynamic – sales enablement refresh** — it has two interactions with two diagnoses, so the readiness trend renders as a progression.

**Steps:**
1. Go back to `/opportunities` and click **Massive Dynamic – sales enablement refresh**.
2. On the Overview tab, scroll down to the **Activity timeline** section.
3. Point out the readiness trend bar: `Diagnosis Aligned · 41 → Stakeholder Validation Needed · 63`. "The same deal, two interactions, you can watch the buyer's readiness advance."
4. Below it, per-interaction list shows each meeting with its readiness state — proof that the trend is real, not retrospective.

**Talking points:**
- "Every diagnosis is anchored to a specific interaction, so the rep — and the manager — can see exactly which conversation moved the needle."

---

## 8. Export the CRM note (~30 seconds — close on this)

End on something tangible the rep would actually do.

**Steps:**
1. Go to **Export** tab on the Massive Dynamic detail (or Globex — either works).
2. Click **Copy CRM note** and paste into a text editor to show the formatted output.

**Talking points:**
- "This is the artifact the rep drops into their CRM activity log. The whole flow takes a minute. The intelligence behind it took the buyer evidence and four prompt chains we ran in the background."

---

## Reset between runs

If you're re-running the demo from a fresh state (e.g. the user signed up during the demo):

1. Sign out from the user menu (top right).
2. Open DevTools → Application → clear localStorage and reload. The Zustand store re-hydrates from the seed.
3. If filters or sort got into a weird state, `Cmd+R` reloads the page.

---

## Known visual issues (do NOT spend demo time on these)

These are tracked in Linear and intentionally deferred:

- **Mobile layout (< 768px):** the opportunity list is a fixed-min-width table that scrolls horizontally inside its container instead of becoming a stacked-card view. Fix tracked as PG-180. Avoid presenting from a phone.
- **Alignment badge palette:** uses up to five colors based on outcome × severity, which crowds the row visually when stacked next to readiness + at-risk. Simplification tracked as PG-181.
- **"Opportunity" concept explainer:** no in-app hint about what an opportunity is vs. a deal. Tracked as PG-179.

---

## Responsive sanity pass (smoke tested 2026-05-18)

Confirmed at the following widths against the seeded demo flow:

| Width  | AppShell sidebar      | Body horizontal scroll | Notes |
| ------ | --------------------- | ---------------------- | ----- |
| 1280px | Visible (240px)       | None                   | Designed default. |
| 1024px | Visible (240px)       | None                   | Opportunity table reaches its 760px min-width and scrolls inside its ScrollArea (not body). Tabs + cards fit. |
| 768px  | Visible (at exactly 768) | None                | Right at the `sm` breakpoint. |
| < 768px | Collapsed behind burger; opens via top-bar toggle | None at page level; table scrolls within ScrollArea | Stacked-card mobile layout is PG-180 follow-up. |

Modals (Add opportunity, Add interaction, Buyer dedup prompt) all fit inside the viewport at all four widths.
