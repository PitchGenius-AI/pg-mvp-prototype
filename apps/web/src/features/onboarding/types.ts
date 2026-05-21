import type { OnboardingDraft } from '../../mock/types';

// Shared constants + helpers for the M10 onboarding wizard. The draft shape
// itself lives in mock/types.ts (the store owns it); this file holds the
// step-numbering and the confirmation-vs-manual mode derivation.

// The full account-creation flow is 11 steps. Step 1 is /signup; the wizard at
// /onboarding renders steps 2–10; step 11 (checkout) lands in M11.
export const ONBOARDING_TOTAL_STEPS = 11;
export const FIRST_WIZARD_STEP = 2;
export const LAST_WIZARD_STEP = 10;

// Steps 4–7 (industry / products / customer / problem) render either pre-filled
// from a successful scrape, or blank for manual entry.
export type OnboardingMode = 'confirmation' | 'manual';

export function onboardingMode(draft: OnboardingDraft): OnboardingMode {
  return draft.scrapeStatus === 'done' ? 'confirmation' : 'manual';
}

// Minimum characters for the substantive free-text steps (customer + problem).
// Product descriptions are kept lighter-touch — there can be several.
export const MIN_CONTEXT_CHARS = 30;

// The uniform props every wizard step component receives from the orchestrator.
export interface OnboardingStepProps {
  step: number;
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  onBack: () => void;
  /** Advances to the next step, or finishes onboarding on the last step. */
  onContinue: () => void;
}
