import type {
  AlignmentLevel,
  AlignmentOutcome,
  ClosedStatus,
  ConfidenceLevel,
  InteractionType,
  OutcomeType,
  ReadinessDiagnosis,
  ReadinessState,
  SignalExtraction,
} from '@pg/shared';

// Prototype-local entities. Shape mirrors the Drizzle tables in @pg/db so that
// swapping in the real tRPC client is mechanical — only ids/timestamps are
// represented as plain strings (the DB issues uuids + Date objects).

export interface MockUser {
  id: string;
  name: string;
  email: string;
}

export type CrmStageTemplate = 'simple_b2b_sales' | 'custom';

export interface MockWorkspace {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  crmStageTemplate: CrmStageTemplate;
  customCrmStages: Array<{ name: string; order: number }> | null;
  createdByUserId: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MockProduct {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  targetBuyer: string;
  problemSolved: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockBuyer {
  id: string;
  workspaceId: string;
  firstName: string;
  lastName: string | null;
  title: string | null;
  company: string;
  email: string | null;
  linkedin: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockOpportunity {
  id: string;
  workspaceId: string;
  buyerId: string;
  productId: string;
  ownerUserId: string;
  opportunityName: string;
  currentCrmStage: string;
  opportunityValue: number | null;
  expectedCloseDate: string | null;
  knownPain: string | null;
  knownObjection: string | null;
  dealNotes: string | null;
  currentReadinessState: ReadinessState | null;
  currentReadinessScore: number | null;
  currentAlignmentOutcome: AlignmentOutcome | null;
  currentAlignmentLevel: AlignmentLevel | null;
  atRisk: boolean;
  closedStatus: ClosedStatus;
  reframedFromOpportunityId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MockInteraction {
  id: string;
  workspaceId: string;
  opportunityId: string;
  interactionType: InteractionType;
  interactionDate: string;
  participants: string[];
  transcriptOrNotes: string | null;
  repSubjectiveNotes: string | null;
  nextStepAgreed: boolean;
  stakeholderAdded: boolean;
  pricingDiscussed: boolean;
  budgetDiscussed: boolean;
  competitorDiscussed: boolean;
  implementationDiscussed: boolean;
  securityDiscussed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MockDiagnosis {
  id: string;
  workspaceId: string;
  opportunityId: string;
  interactionId: string;
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
