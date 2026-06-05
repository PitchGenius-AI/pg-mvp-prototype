// Static content + visual constants for the in-call overlay mock (M20,
// PG-238/239). Two consumers live in this folder:
//   - the static gallery (overlay-states.tsx) — hand-authored design artifacts
//     anchored on the hero deal (Globex – CDP replacement Q2, buyer Jamie Park)
//     and the SPIN technique the pre-call intelligence matches to that buyer.
//   - the interactive demo (live-copilot-demo.tsx) — a working pick → call →
//     coach → end → handoff flow. Its picker is wired to the real seeded
//     opportunities; the scripted CONVERSATION below is deal-agnostic (it
//     interpolates the picked buyer's first name) so it reads naturally over
//     whichever deal the rep binds the call to.

import type { ReadinessState } from '@pg/shared';

// --- The overlay "window" palette ------------------------------------------
// The overlay is a floating desktop window, not an app page. It renders dark
// regardless of the web app's light/dark scheme, so every colour inside the
// window is set explicitly — `c="dimmed"` would resolve against the *page*
// scheme and disappear on the dark surface.

export const OVERLAY = {
  windowBg: 'var(--mantine-color-dark-7)',
  headerBg: 'var(--mantine-color-dark-8)',
  panelBg: 'var(--mantine-color-dark-5)',
  border: 'var(--mantine-color-dark-4)',
  textPrimary: 'var(--mantine-color-gray-0)',
  textSecondary: 'var(--mantine-color-dark-1)',
  textMuted: 'var(--mantine-color-dark-2)',
} as const;

// The matched sales technique for the bound deal. Globex's buyer (Jamie Park,
// Director of Revenue Operations) reads as a high-C analytical buyer, which the
// pre-call intelligence matches to SPIN — so every prompt in the overlay is
// phrased as a SPIN move.
export const TECHNIQUE_LABEL = 'SPIN';
export const TECHNIQUE_COLOR = 'indigo';

// The glance dot per readiness state — a quiet progression from cool/early to
// warm/ready, with at_risk the one alarm colour. The overlay shows the state,
// never the 0–100 score (that lives in the web app). Mirrors the ordering in
// the workbench's READINESS labels.
export const READINESS_DOT: Record<ReadinessState, string> = {
  unaware: 'var(--mantine-color-gray-5)',
  problem_aware: 'var(--mantine-color-yellow-5)',
  diagnosis_aligned: 'var(--mantine-color-lime-5)',
  solution_curious: 'var(--mantine-color-cyan-5)',
  solution_confident: 'var(--mantine-color-blue-5)',
  stakeholder_validation_needed: 'var(--mantine-color-indigo-4)',
  commercially_ready: 'var(--mantine-color-grape-5)',
  commit_ready: 'var(--mantine-color-teal-5)',
  at_risk: 'var(--mantine-color-red-6)',
};

// The deal this mocked call is bound to.
export const BOUND_DEAL = {
  opportunityName: 'Globex – CDP replacement Q2',
  buyerLine: 'Jamie Park · Globex Industries',
  readinessLabel: 'Problem aware',
  // A quiet glance dot — the overlay shows the readiness *state*, never the
  // 0–100 score (that lives in the web app).
  readinessDot: 'var(--mantine-color-yellow-5)',
} as const;

// --- Prompt copy -----------------------------------------------------------

// The resting in-call hero: one prompt card, the single next move, phrased as a
// SPIN Problem question.
export const RESTING_PROMPT = {
  techniqueMove: 'Problem question',
  why: "Jamie keeps deferring to “the team.” Don't chase a next step yet — surface the real blocker first.",
  say: 'Help me understand — what has to be true inside Globex before you could personally say yes to replacing the CDP?',
} as const;

// The missing-question nudge: the overlay noticed the rep covered the problem
// but never made its cost real. Phrased as a SPIN Implication question.
export const NUDGE_PROMPT = {
  techniqueMove: 'Implication question',
  why: "You've named the problem but not its cost. Make the July auto-renewal real.",
  say: "If the team doesn't meet before the July renewal, what does another year locked into the current CDP actually cost you?",
} as const;

// The two collapsed affordances under the resting prompt.
export const COLLAPSED_AFFORDANCES = [
  { key: 'script', label: 'Call script', meta: 'SPIN · 4 sections' },
  { key: 'questions', label: 'Still to ask', meta: '3 questions' },
] as const;

// --- Interactive demo: the scripted conversation ---------------------------
// The mocked call the interactive demo (live-copilot-demo.tsx) plays out. The
// transcript and the coaching prompts are deal-agnostic — `{first}` is replaced
// with the picked buyer's first name at render time — so the same script reads
// naturally over whichever opportunity the rep binds the call to. It walks the
// four SPIN moves (Situation → Problem → Implication → Need-payoff) and fires
// one nudge when the buyer names a cost and then waves it off.

// A coaching prompt the overlay surfaces mid-call. Same shape the static
// gallery's PromptCard renders.
export interface CopilotPrompt {
  tone: 'resting' | 'nudge';
  techniqueMove: string;
  why: string;
  say: string;
}

// One moment on the call timeline, keyed to seconds since the call started.
// A beat may add a transcript line, surface a new coaching prompt, or both.
export interface ConversationBeat {
  // Seconds into the call when this beat fires.
  at: number;
  speaker?: 'rep' | 'buyer';
  line?: string;
  prompt?: CopilotPrompt;
}

export const CONVERSATION: ConversationBeat[] = [
  {
    at: 1,
    prompt: {
      tone: 'resting',
      techniqueMove: 'Situation question',
      why: "Open by mapping how {first}'s team works today — don't pitch yet.",
      say: 'Walk me through how your team handles this right now, start to finish.',
    },
  },
  {
    at: 3,
    speaker: 'rep',
    line: 'Thanks for making the time, {first}. Walk me through how your team handles this today, start to finish.',
  },
  {
    at: 7,
    speaker: 'buyer',
    line: "Sure. Right now it's mostly manual — a couple of spreadsheets, and we reconcile everything by hand each week.",
  },
  {
    at: 11,
    prompt: {
      tone: 'resting',
      techniqueMove: 'Problem question',
      why: "There's friction in that manual process. Find where it actually hurts.",
      say: 'Where does that weekly reconciliation tend to break down or eat the most time?',
    },
  },
  {
    at: 12,
    speaker: 'rep',
    line: 'Where does that reconciliation tend to break down or eat the most time?',
  },
  {
    at: 16,
    speaker: 'buyer',
    line: "Honestly, the back-and-forth. Two of my analysts lose most of Monday to it every week.",
  },
  {
    at: 20,
    speaker: 'buyer',
    line: "But the team's used to it. We'll probably revisit it after the renewal.",
  },
  {
    at: 22,
    prompt: {
      tone: 'nudge',
      techniqueMove: 'Implication question',
      why: '{first} just named a cost and waved it off. Make the cost of waiting real before they park it.',
      say: 'If two analysts lose every Monday to this, what does that add up to over a quarter — and what happens if it’s still unsolved at renewal?',
    },
  },
  {
    at: 24,
    speaker: 'rep',
    line: "If two analysts lose every Monday to this, what's that adding up to over a full quarter?",
  },
  {
    at: 29,
    speaker: 'buyer',
    line: "...when you put it that way, it's most of a headcount. That's not nothing.",
  },
  {
    at: 33,
    prompt: {
      tone: 'resting',
      techniqueMove: 'Need-payoff question',
      why: '{first} feels the cost now. Let them say the value of solving it out loud.',
      say: 'If your team got every Monday back and the reconciliation just ran itself, what would that free them up to do?',
    },
  },
  {
    at: 35,
    speaker: 'rep',
    line: 'If your team got every Monday back, what would that free them up to focus on instead?',
  },
  {
    at: 40,
    speaker: 'buyer',
    line: 'Forecasting, instead of cleaning data. Okay — walk me through what rollout would actually look like.',
  },
];

// The processing steps the overlay runs after the rep ends the call, before it
// hands back to the web app. Driven on a timer in the interactive demo.
export const PROCESSING_STEPS = [
  'Transcript captured',
  'Generating the readiness diagnosis',
  'Re-scoring the deal',
] as const;
