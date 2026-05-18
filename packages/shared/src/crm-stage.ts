// The single CRM stage template shipped in MVP. Additional templates are post-MVP
// pending real-user pipeline observations (see spec §2).

export const SIMPLE_B2B_SALES_STAGES = [
  'New Lead',
  'Qualified',
  'Discovery',
  'Demo',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
] as const;

export type SimpleB2BSalesStage = (typeof SIMPLE_B2B_SALES_STAGES)[number];

// Implicit readiness state a rep is asserting when they place an opportunity in a stage.
// Used by the Pipeline Reality Check to detect over/under-projection.
export const STAGE_IMPLIED_READINESS: Record<SimpleB2BSalesStage, string> = {
  'New Lead': 'unaware',
  Qualified: 'problem_aware',
  Discovery: 'diagnosis_aligned',
  Demo: 'solution_curious',
  Proposal: 'solution_confident',
  Negotiation: 'commit_ready',
  'Closed Won': 'commit_ready',
  'Closed Lost': 'unaware',
};
