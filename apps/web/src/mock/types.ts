import type {
  Activity,
  AlignmentLevel,
  AlignmentOutcome,
  Buyer,
  ClosedStatus,
  ConfidenceLevel,
  CrmStageTemplate,
  ImportMapping,
  Opportunity,
  PrecallIntelligence,
  Product,
  ReadinessDiagnosis,
  ReadinessState,
  ScriptTemplate,
  SignalExtraction,
  Workspace,
  OutcomeType,
} from '@pg/shared';

// Prototype-local entities. The store shape is a faithful mirror of the zod
// entity schemas in @pg/shared (the SHARED CONTRACT) — the `Mock*` aliases below
// derive straight from `z.infer` of those schemas, so swapping in the real tRPC
// client later is mechanical. IDs and timestamps are plain strings here (the DB
// issues uuids + Date objects); both shapes parse against the same schemas.

export type { CrmStageTemplate };

export type MockWorkspace = Workspace;
export type MockProduct = Product;
export type MockBuyer = Buyer;
export type MockOpportunity = Opportunity;
export type MockActivity = Activity;
export type MockScriptTemplate = ScriptTemplate;
export type MockImportMapping = ImportMapping;
export type MockPrecallIntelligence = PrecallIntelligence;

export interface MockUser {
  id: string;
  name: string;
  email: string;
}

// Denormalized read-model: holds the validated AI output verbatim (`diagnosis`,
// `signalExtraction`) plus discrete columns for filtering/sorting. One per activity.
export interface MockDiagnosis {
  id: string;
  workspaceId: string;
  opportunityId: string;
  activityId: string;
  signalExtraction: SignalExtraction;
  diagnosis: ReadinessDiagnosis;
  readinessState: ReadinessState;
  readinessScore: number;
  confidenceLevel: ConfidenceLevel;
  alignmentOutcome: AlignmentOutcome;
  alignmentLevel: AlignmentLevel;
  alignmentReason: string;
  primaryBlocker: string | null;
  secondaryBlocker: string | null;
  crmNoteText: string;
  followUpSubject: string | null;
  followUpBody: string | null;
  managerCoachingNote: string | null;
  createdAt: string;
}

export interface MockOutcome {
  id: string;
  workspaceId: string;
  opportunityId: string;
  diagnosisId: string;
  outcomeType: OutcomeType;
  outcomeNotes: string | null;
  dealAdvanced: boolean;
  buyerReplied: boolean;
  nextMeetingBooked: boolean;
  stakeholderAdded: boolean;
  closedWon: boolean;
  closedLost: boolean;
  createdAt: string;
}

export interface MockSession {
  user: MockUser;
  workspaceId: string;
  workspaceOnboardingCompleted: boolean;
}

// --- Onboarding (M10) ---

// Stable-ish id helper for prototype-local draft rows (onboarding products,
// custom CRM stages) that have no DB id yet.
export const newDraftId = (prefix: string): string =>
  `${prefix}_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(
    /-/g,
    '',
  )}`;

// One in-progress product captured during onboarding step 5. Carries a local
// draft id; committed to a real `Product` row — with the workspace-level
// customer/problem fanned in — when onboarding finishes.
export interface OnboardingDraftProduct {
  id: string;
  name: string;
  description: string;
  isPrimary: boolean;
}

// Resolved outcome of the step-3 website scrape. `done` → steps 4–7 run in
// confirmation mode (pre-filled); `failed`/`skipped` → manual-entry mode.
export type OnboardingScrapeStatus = 'idle' | 'done' | 'failed' | 'skipped';

// Step-9 CRM selection. `hubspot`/`pipedrive` map to a real `crmType`; `none`
// and `other` leave it null and degrade export to copy-ready notes.
export type OnboardingCrmChoice = 'hubspot' | 'pipedrive' | 'none' | 'other';

// The full onboarding wizard state. Lives in the mock store so per-step edits
// persist across in-app navigation (PG-190). Covers steps 2–10 of the 11-step
// flow — step 1 is /signup and step 11 (checkout) is the /checkout route (M11).
export interface OnboardingDraft {
  currentStep: number;
  workspaceName: string;
  website: string;
  scrapeStatus: OnboardingScrapeStatus;
  industry: string;
  products: OnboardingDraftProduct[];
  targetCustomer: string;
  coreProblem: string;
  scriptContent: string;
  scriptSkipped: boolean;
  crmChoice: OnboardingCrmChoice | null;
  crmOtherText: string;
  stageTemplate: CrmStageTemplate;
  customStages: Array<{ id: string; name: string }>;
}

// Fresh draft — the starting point at signup and after onboarding completes.
// A function (not a const) so every reset gets its own array references + ids.
export function createInitialOnboardingDraft(): OnboardingDraft {
  return {
    currentStep: 2,
    workspaceName: '',
    website: '',
    scrapeStatus: 'idle',
    industry: '',
    products: [{ id: newDraftId('prod'), name: '', description: '', isPrimary: true }],
    targetCustomer: '',
    coreProblem: '',
    scriptContent: '',
    scriptSkipped: false,
    crmChoice: null,
    crmOtherText: '',
    stageTemplate: 'simple_b2b_sales',
    customStages: [
      { id: newDraftId('stage'), name: '' },
      { id: newDraftId('stage'), name: '' },
    ],
  };
}
