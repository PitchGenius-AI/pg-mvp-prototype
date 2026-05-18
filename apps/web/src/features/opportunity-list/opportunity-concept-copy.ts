// Shared copy for the "What's an opportunity?" explainer. Used by both the
// empty-state Alert and the populated-state info popover so the two surfaces
// can never drift out of sync.

export const OPPORTUNITY_CONCEPT_HEADING = "What's an opportunity?";

export const OPPORTUNITY_CONCEPT_BODY = [
  "An opportunity is a buyer at a company evaluating your product for a specific deal. It's the unit Pitch Genius diagnoses — pulling evidence from your meetings and notes to score buyer readiness and flag pipeline mismatches.",
  'One buyer can have multiple opportunities over time (current, historical, reframed).',
] as const;
