// Static content + visual constants for the in-call overlay design mock
// (M20, PG-238/239). The overlay itself is part of the Live Co-pilot desktop
// app — a separate future-phase build — so nothing here is wired to the mock
// store or the seed; it is a hand-authored design artifact. The copy is
// anchored on the demo's hero deal (Globex – CDP replacement Q2, buyer Jamie
// Park) and the SPIN technique the pre-call intelligence matches to that buyer,
// so the mock reads as continuous with the rest of the walkthrough.

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

// A generic opener shown in the unbound state — coaching still works without a
// deal, it just has nowhere to save the call.
export const UNBOUND_PROMPT = {
  techniqueMove: 'Situation question',
  why: 'No deal context loaded — start by mapping how the buyer works today.',
  say: 'Walk me through how your team handles this right now, start to finish.',
} as const;

// The two collapsed affordances under the resting prompt.
export const COLLAPSED_AFFORDANCES = [
  { key: 'script', label: 'Call script', meta: 'SPIN · 4 sections' },
  { key: 'questions', label: 'Still to ask', meta: '3 questions' },
] as const;

// --- Opportunity picker ----------------------------------------------------
// The desktop app's own opportunity picker — shown when the rep launches the
// co-pilot without a deal already attached (e.g. from the `/copilot` screen's
// Launch button rather than an opportunity header).

export interface PickerRow {
  opportunityName: string;
  buyerLine: string;
  readinessLabel: string;
  readinessDot: string;
}

export const PICKER_ROWS: PickerRow[] = [
  {
    opportunityName: 'Globex – CDP replacement Q2',
    buyerLine: 'Jamie Park · Globex Industries',
    readinessLabel: 'Problem aware',
    readinessDot: 'var(--mantine-color-yellow-5)',
  },
  {
    opportunityName: 'Massive Dynamic – sales enablement refresh',
    buyerLine: 'Renee Adeyemi · Massive Dynamic',
    readinessLabel: 'Stakeholder validation',
    readinessDot: 'var(--mantine-color-blue-5)',
  },
  {
    opportunityName: 'Initech – reporting refresh',
    buyerLine: 'Marcus Bennett · Initech',
    readinessLabel: 'Diagnosis aligned',
    readinessDot: 'var(--mantine-color-gray-5)',
  },
  {
    opportunityName: 'Wayne – live call co-pilot trial',
    buyerLine: 'Lucia Ortiz · Wayne Industries',
    readinessLabel: 'Provisional — no activity',
    readinessDot: 'var(--mantine-color-dark-2)',
  },
];
