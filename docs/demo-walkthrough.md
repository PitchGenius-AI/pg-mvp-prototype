# Pitch Genius demo walkthrough

Use this script when presenting the Buyer Readiness MVP prototype to a client. Follow the steps in order — the seed data is tuned so each step has a moment that lands.

> **Setup before the call:** run `pnpm dev` and open <http://localhost:5173> in a clean Chrome profile (so you start logged out). If the seed has drifted, hard-reload the page to re-hydrate from `apps/web/src/mock/seed.ts`.

---

## 1. Sign up + onboarding (~4 minutes)

**What to say:**
> "Pitch Genius is buyer-readiness intelligence for individual sales reps. Let me walk you through what a brand-new user experiences from the very first screen."

**Steps:**
1. Land on `/login` → click **Sign up**.
2. **Create account:** enter a name, a fresh email, and a password (8+ characters with a letter and a number). Inline validation fires on blur — to show it off, try `casey@acmesales.co` (reads as already registered) or a 3-character password.
3. The onboarding wizard opens — steps 2–10 of the 11-step account-creation flow. Step through it:
   - **Workspace name** — "Acme Sales Co".
   - **Website** — paste any URL and click **Analyze my website**. Watch the "Reading your website…" animation; it pre-fills the next four steps. (To demo the fallback instead, use a URL containing the word `fail` — the scrape "can't read" the site and steps 4–7 switch to blank manual entry. The **Skip** link does the same.)
   - **Industry / Products / Customer / Problem** — pre-filled from the scrape. Talk through editing the product list and marking a **primary** product; every readiness diagnosis is anchored to this product context.
   - **Call script** — paste a script, upload a file, or click **I don't have a script**.
   - **CRM** — pick HubSpot or Pipedrive (None / Other degrade export to copy-ready notes).
   - **Pipeline stages** — pick **Simple B2B Sales**.
4. Click **Continue to checkout** on the pipeline-stages step. This commits the workspace and hands off to step 11.
5. **Checkout (step 11):** a mock Stripe screen. The hard paywall holds a brand-new account here until payment "completes". Enter any card details and click **Pay $49 and continue** — watch the processing state resolve to a success panel, then you land in the app on a fresh, empty workspace.
   - To demo a decline instead, use a card number ending in `0002` (mirrors Stripe's classic decline test card) — the screen shows a "Card declined" error and lets you retry.
   - Pricing on this screen is a placeholder pending Russell ([FLAG] in [routes/checkout.tsx](../apps/web/src/routes/checkout.tsx)) — don't quote the number as final.

**Talking points:**
- "Account to a configured workspace in a couple of minutes — and the website scrape means the rep confirms rather than types."
- "The flow adapts: a thin or missing website just drops the rep into manual entry, no dead ends."
- "The paywall is hard — a new account can't reach a single in-app screen until checkout completes." (Existing demo accounts come in via the sign-in flow already subscribed, so they skip this.)

> **For the rest of the demo** you want the pre-loaded pipeline. Sign out, then **Sign in** (any email + password) — that loads the seeded demo workspace with ten deals.

---

## 2. Add an opportunity — four intake methods (~3.5 minutes)

The Pitch Genius value prop is that capturing buyer evidence has to feel effortless. Intake is its own page — `/buyers/new` — with four methods as tabs. Show all four so the audience sees the breadth; spend most of the time on the Daily Workbench import and the Activity history import (the two bulk paths).

**Steps:**
1. Click **Add opportunity** at the top right of the Workbench — it opens the `/buyers/new` intake page.
2. Walk the four tabs:
   - **Structured form** — "for the rep who already knows the shape of the deal." One fully-formed opportunity in a single step: buyer fields, a **product** (defaulted to the workspace's primary, changeable when there's more than one), and optional deal context.
   - **Paste** — "paste meeting notes, the parser pulls out buyer + opportunity fields, you review and confirm." Paste a short paragraph, show the fake-AI animation, let it land on the review screen, then switch away without saving. (Paste carries a visible placeholder banner — its final behaviour is a [FLAG] pending Russell.)
   - **Daily Workbench import** — the bulk path. Talk through the per-CRM **export guidance** panel, then drop a file (use the **Download a sample Daily Workbench file** link). Walk the **adaptive column mapping** — each column auto-mapped with a confidence badge — and the **confirm-mapping gate**. The review screen then shows the **missing-data check**, the **CRM Record ID soft gate** (a per-import acknowledgment when deals lack a Record ID), and the **assign-now vs. decide-later** choice. Confirm the mapping is saved so the next import reuses it. On the success screen, follow the **Add activity history** prompt straight into the next tab.
   - **Activity history** — the optional bulk activity import. "Day one, your deals exist but they have no conversations behind them — readiness is provisional. This backfills the history." Drop the file (use **Download a sample activities file**), walk the adaptive column mapping, then the review screen: activities **auto-join to their deals by CRM Record ID** — no manual assignment — with an **activity-type breakdown** (calls / emails / meetings) and an **unmatched panel** for activities whose Record ID isn't on the workbench. Importing re-scores every matched deal.
3. Head back to the Workbench — you already have ten seeded deals to work from.

**Talking points:**
- "We do not replace your CRM. We sit alongside it, ingest the same evidence your reps already produce, and surface diagnoses your CRM cannot."
- "The Daily Workbench import adapts to whatever your CRM exports — no required column layout — and you only pay the mapping friction once."
- "Activities auto-join by Record ID — the rep never hand-assigns a call to a deal. That's what turns day-one readiness from a guess into something real."

---

## 3. The Opportunity Workbench — surface the over-projecting deals (~1.5 minutes)

After sign-in the rep lands on the **Opportunity Workbench** at `/` — the daily cockpit. It has two views of the same ten deals, and it's the setup for the punchline: *some deals are not where the CRM says they are*.

**Steps:**
1. **Board view** (the default) — a Kanban board, one column per CRM stage. Each card carries an alignment badge; a red **Mismatch** badge with an "Over-projecting" sub-label is the signal that should draw the eye.
2. Drag a card forward a stage or two. The alignment badge re-checks live against the *unchanged* buyer evidence — a deal that was Aligned can flip to a Mismatch the moment you advance its CRM stage. "Moving a deal in the CRM doesn't move the buyer." (Hard-reload afterwards to reset the board.)
3. Switch to **List view** with the toggle in the header.
4. Click **Over-projecting only**. The list narrows to four deals: **Globex (critical)**, **Initech (high)**, **Soylent (high)**, and **Pied Piper (low)** — sorted most-severe-first by default, so Globex sits on top.
5. Note Soylent's readiness badge: **At risk / regressed** — the buyer has gone backwards, not just stalled.
6. Point out the blue **no-activity banner** pinned above the views and the orange **No activity** badge on the Wayne Enterprises co-pilot deal — "this deal has no conversations logged, so its readiness is provisional. Add or import activity and the score sharpens." The banner's **Import activity history** button deep-links to the bulk activity import from step 2.

**Talking points:**
- "Four of ten deals in this pipeline are over-projecting. That's the kind of forecast surprise that costs a quarter."
- "Notice we are not telling the rep their deal is dead — we are telling them the *stage they have it at* is ahead of what the buyer evidence supports."
- "A deal with no activity isn't scored on a guess — we flag it as provisional and tell the rep exactly how to firm it up."

---

## 4. Land the Pipeline Reality Check on the Globex deal (~2 minutes — THIS IS THE PUNCHLINE)

**Steps:**
1. Open **Globex – CDP replacement Q2** (the critical over-projection).
2. The **persistent score header** carries the headline on every tab: hero score **28/100**, **Problem aware**, a red **Mismatch · Over-projecting · critical** badge, CRM stage **Negotiation**. "Five readiness stages of gap — and that header follows you across all four tabs."
3. Click into the **Diagnosis** tab.
4. The **Pipeline Reality Check** callout is the moment of value. Sit on it. Read the framing aloud:
   > "CRM Negotiation implies commitment readiness, but evidence shows the buyer has not aligned the team, discussed budget, or agreed a next step. Five readiness stages of gap."
5. Walk down the dimension scores: pain 45, urgency 30, commitment 10 (this is where the bottom drops out).
6. Read the **Primary blocker** — and the **Recommended next action**. Emphasize: "Stop sending pricing. Re-qualify."

**Talking points:**
- "This is the artifact that does not exist today. The CRM tells you what stage the rep *said* the deal is at. The Pipeline Reality Check tells you what stage the *buyer* is at."
- "If a manager sees this on a Monday morning, the conversation with the rep is now possible. Without it, they're flying blind."

---

## 5. Tour all 4 tabs on the same deal (~3 minutes)

Now you've sold the headline. Use Globex (still loaded) to walk through what the rest of the product looks like. The score header stays pinned above all four tabs.

**Steps:**
1. **Overview** — the pre-call intelligence. A **DISC + OCEAN psychological profile** of the buyer, a **matched sales technique** (Challenger / SPIN / NEPQ) with reasoning, and a **generated pre-call script** in that technique — editable and regenerable. Below it, the opportunity context the rep captured. "All of this is ready before the rep ever logs a conversation." (On a deal you've not opened before, watch it generate progressively.)
2. **Activity** — the activities list (call / email / meeting / note), each card showing the readiness state it produced. Click **Add activity** to show the form (but don't run a diagnosis here — keep momentum). On a multi-activity deal a **readiness trend** bar sits up top (see step 6).
3. **Diagnosis** — already shown in step 4. Scroll down past the Pipeline Reality Check to show signal cards (Observed Evidence / AI Inference / Missing Evidence sections), the **What not to do yet** card, the **Follow-up email** (copy-to-clipboard), and the **Manager coaching note**.
4. **Export** — a single human-readable **CRM note**. **Copy note** always works; **Download import file** is enabled here because this deal carries a CRM Record ID. The **follow-up email** is a separate, separately-copyable draft. "Drop the note straight into your CRM activity log."

**Talking points:**
- "Every artifact on this page is generated from the same buyer evidence. No double-entry from the rep."
- "The pre-call intelligence needs no activity at all — profile, technique, and script are ready the moment the opportunity exists."
- "The follow-up email isn't a generic template — it adapts to the readiness state and alignment outcome. A buyer at Problem Aware gets a different email than a buyer at Commit Ready."

---

## 6. Show readiness progression on a multi-activity deal (~1 minute)

This is a deeper second example. Pick **Massive Dynamic – sales enablement refresh** — it has two activities with two diagnoses, so the readiness trend renders as a progression.

**Steps:**
1. Go back to the Workbench (`/`) and open **Massive Dynamic – sales enablement refresh**.
2. Open the **Activity** tab.
3. Point out the **Readiness trend** bar at the top: `Diagnosis aligned · 41 → Stakeholder validation · 63`. "The same deal, two activities, you can watch the buyer's readiness advance."
4. Below it, each activity card shows the readiness state it produced — proof that the trend is real, not retrospective.

**Talking points:**
- "Every diagnosis is anchored to a specific activity, so the rep — and the manager — can see exactly which conversation moved the needle."

---

## 7. Export the CRM note (~30 seconds — close on this)

End on something tangible the rep would actually do.

**Steps:**
1. Go to the **Export** tab on the Massive Dynamic detail (or Globex — either works).
2. Click **Copy note** and paste into a text editor to show the formatted, human-readable output.
3. Point out the two-tier model: a deal with a CRM Record ID also gets **Download import file** (a note file the CRM ingests directly); a deal without one is copy-only.

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

These are intentionally deferred:

- **Mobile layout (< 768px):** the Workbench Board is a horizontally-scrolling Kanban and the List is a wide table — neither reflows to a stacked layout. Present from a laptop, not a phone.
- **Board column height:** stage columns size to their content, so a stage with many more cards than its neighbours makes the board look uneven. Acceptable for the seeded data.

---

## Responsive sanity pass (smoke tested 2026-05-18)

Confirmed at the following widths against the seeded demo flow:

| Width  | AppShell sidebar      | Body horizontal scroll | Notes |
| ------ | --------------------- | ---------------------- | ----- |
| 1280px | Visible (240px)       | None                   | Designed default. |
| 1024px | Visible (240px)       | None                   | Workbench Board / List scroll horizontally inside their own containers, not the body. |
| 768px  | Visible (at exactly 768) | None                | Right at the `sm` breakpoint. |
| < 768px | Collapsed behind burger; opens via top-bar toggle | None at page level; Board / List scroll within their containers | Board + List don't reflow to a stacked layout — present from a laptop. |

Modals (Add opportunity, Add activity, Buyer dedup prompt) all fit inside the viewport at all four widths.
