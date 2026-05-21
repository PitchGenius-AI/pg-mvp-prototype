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
