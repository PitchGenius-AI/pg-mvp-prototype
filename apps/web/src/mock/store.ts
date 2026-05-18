import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  MockBuyer,
  MockDiagnosis,
  MockInteraction,
  MockOpportunity,
  MockOutcome,
  MockProduct,
  MockSession,
  MockWorkspace,
} from './types';

interface MockState {
  session: MockSession | null;
  workspaces: Record<string, MockWorkspace>;
  products: Record<string, MockProduct>;
  buyers: Record<string, MockBuyer>;
  opportunities: Record<string, MockOpportunity>;
  interactions: Record<string, MockInteraction>;
  diagnoses: Record<string, MockDiagnosis>;
  outcomes: Record<string, MockOutcome>;
}

export interface HydrateInput {
  workspaces: MockWorkspace[];
  products: MockProduct[];
  buyers: MockBuyer[];
  opportunities: MockOpportunity[];
  interactions: MockInteraction[];
  diagnoses: MockDiagnosis[];
  outcomes: MockOutcome[];
}

interface MockActions {
  hydrate: (input: HydrateInput) => void;
  reset: () => void;

  setSession: (session: MockSession) => void;
  clearSession: () => void;
  completeOnboarding: () => void;

  addBuyer: (input: Omit<MockBuyer, 'id' | 'createdAt' | 'updatedAt'>) => MockBuyer;
  addOpportunity: (
    input: Omit<
      MockOpportunity,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'currentReadinessState'
      | 'currentReadinessScore'
      | 'currentAlignmentOutcome'
      | 'currentAlignmentLevel'
      | 'closedStatus'
      | 'reframedFromOpportunityId'
      | 'atRisk'
    > &
      Partial<Pick<MockOpportunity, 'atRisk' | 'closedStatus'>>,
  ) => MockOpportunity;
  addInteraction: (
    input: Omit<MockInteraction, 'id' | 'createdAt' | 'updatedAt'>,
  ) => MockInteraction;
  runDiagnosis: (
    input: Omit<MockDiagnosis, 'id' | 'createdAt'>,
  ) => MockDiagnosis;
  recordOutcome: (input: Omit<MockOutcome, 'id' | 'createdAt'>) => MockOutcome;
  setAtRisk: (opportunityId: string, atRisk: boolean) => void;
}

const emptyState: MockState = {
  session: null,
  workspaces: {},
  products: {},
  buyers: {},
  opportunities: {},
  interactions: {},
  diagnoses: {},
  outcomes: {},
};

const newId = (prefix: string) =>
  `${prefix}_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(
    /-/g,
    '',
  )}`;

const nowIso = () => new Date().toISOString();

export const useMockStore = create<MockState & MockActions>()(
  devtools(
    (set, get) => ({
      ...emptyState,

      hydrate: (input) =>
        set(
          () => ({
            workspaces: Object.fromEntries(input.workspaces.map((w) => [w.id, w])),
            products: Object.fromEntries(input.products.map((p) => [p.id, p])),
            buyers: Object.fromEntries(input.buyers.map((b) => [b.id, b])),
            opportunities: Object.fromEntries(input.opportunities.map((o) => [o.id, o])),
            interactions: Object.fromEntries(input.interactions.map((i) => [i.id, i])),
            diagnoses: Object.fromEntries(input.diagnoses.map((d) => [d.id, d])),
            outcomes: Object.fromEntries(input.outcomes.map((o) => [o.id, o])),
          }),
          undefined,
          'mock/hydrate',
        ),

      reset: () => set(() => ({ ...emptyState }), undefined, 'mock/reset'),

      setSession: (session) => set(() => ({ session }), undefined, 'mock/setSession'),

      clearSession: () => set(() => ({ session: null }), undefined, 'mock/clearSession'),

      completeOnboarding: () =>
        set(
          (state) => {
            if (!state.session) return state;
            const workspaceId = state.session.workspaceId;
            const workspace = state.workspaces[workspaceId];
            if (!workspace) return state;
            return {
              session: { ...state.session, workspaceOnboardingCompleted: true },
              workspaces: {
                ...state.workspaces,
                [workspaceId]: { ...workspace, onboardingCompleted: true, updatedAt: nowIso() },
              },
            };
          },
          undefined,
          'mock/completeOnboarding',
        ),

      addBuyer: (input) => {
        const buyer: MockBuyer = {
          ...input,
          id: newId('buy'),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => ({ buyers: { ...state.buyers, [buyer.id]: buyer } }),
          undefined,
          'mock/addBuyer',
        );
        return buyer;
      },

      addOpportunity: (input) => {
        const opp: MockOpportunity = {
          ...input,
          id: newId('opp'),
          atRisk: input.atRisk ?? false,
          closedStatus: input.closedStatus ?? 'open',
          currentReadinessState: null,
          currentReadinessScore: null,
          currentAlignmentOutcome: null,
          currentAlignmentLevel: null,
          reframedFromOpportunityId: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => ({ opportunities: { ...state.opportunities, [opp.id]: opp } }),
          undefined,
          'mock/addOpportunity',
        );
        return opp;
      },

      addInteraction: (input) => {
        const interaction: MockInteraction = {
          ...input,
          id: newId('int'),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => ({
            interactions: { ...state.interactions, [interaction.id]: interaction },
          }),
          undefined,
          'mock/addInteraction',
        );
        return interaction;
      },

      runDiagnosis: (input) => {
        const diagnosis: MockDiagnosis = {
          ...input,
          id: newId('dx'),
          createdAt: nowIso(),
        };
        set(
          (state) => {
            const opp = state.opportunities[diagnosis.opportunityId];
            if (!opp) {
              return { diagnoses: { ...state.diagnoses, [diagnosis.id]: diagnosis } };
            }
            return {
              diagnoses: { ...state.diagnoses, [diagnosis.id]: diagnosis },
              opportunities: {
                ...state.opportunities,
                [opp.id]: {
                  ...opp,
                  currentReadinessState: diagnosis.readinessState,
                  currentReadinessScore: diagnosis.readinessScore,
                  currentAlignmentOutcome: diagnosis.alignmentOutcome,
                  currentAlignmentLevel: diagnosis.alignmentLevel,
                  updatedAt: nowIso(),
                },
              },
            };
          },
          undefined,
          'mock/runDiagnosis',
        );
        return diagnosis;
      },

      recordOutcome: (input) => {
        const outcome: MockOutcome = {
          ...input,
          id: newId('out'),
          createdAt: nowIso(),
        };
        set(
          (state) => {
            const opp = state.opportunities[outcome.opportunityId];
            const closedStatus = outcome.closedWon
              ? 'closed_won'
              : outcome.closedLost
                ? 'closed_lost'
                : opp?.closedStatus ?? 'open';
            return {
              outcomes: { ...state.outcomes, [outcome.id]: outcome },
              ...(opp
                ? {
                    opportunities: {
                      ...state.opportunities,
                      [opp.id]: { ...opp, closedStatus, updatedAt: nowIso() },
                    },
                  }
                : {}),
            };
          },
          undefined,
          'mock/recordOutcome',
        );
        return outcome;
      },

      setAtRisk: (opportunityId, atRisk) =>
        set(
          (state) => {
            const opp = state.opportunities[opportunityId];
            if (!opp) return state;
            return {
              opportunities: {
                ...state.opportunities,
                [opportunityId]: { ...opp, atRisk, updatedAt: nowIso() },
              },
            };
          },
          undefined,
          'mock/setAtRisk',
        ),
    }),
    { name: 'pg-mock-store', enabled: import.meta.env.DEV },
  ),
);

// --- Selector hooks (subscribe to fine-grained slices) ---

export const useCurrentSession = () => useMockStore((s) => s.session);

export const useWorkspace = () =>
  useMockStore((s) => (s.session ? s.workspaces[s.session.workspaceId] ?? null : null));

export const useProductForCurrentWorkspace = () =>
  useMockStore((s) => {
    if (!s.session) return null;
    return (
      Object.values(s.products).find((p) => p.workspaceId === s.session?.workspaceId) ?? null
    );
  });

export const useOpportunities = () =>
  useMockStore((s) => {
    if (!s.session) return [];
    const workspaceId = s.session.workspaceId;
    return Object.values(s.opportunities).filter((o) => o.workspaceId === workspaceId);
  });

export const useOpportunityById = (id: string | undefined) =>
  useMockStore((s) => (id ? s.opportunities[id] ?? null : null));

export const useBuyerById = (id: string | undefined) =>
  useMockStore((s) => (id ? s.buyers[id] ?? null : null));

export const useInteractionsForOpportunity = (opportunityId: string | undefined) =>
  useMockStore((s) => {
    if (!opportunityId) return [];
    return Object.values(s.interactions)
      .filter((i) => i.opportunityId === opportunityId)
      .sort((a, b) => b.interactionDate.localeCompare(a.interactionDate));
  });

export const useDiagnosisById = (id: string | undefined) =>
  useMockStore((s) => (id ? s.diagnoses[id] ?? null : null));

export const useLatestDiagnosisForOpportunity = (opportunityId: string | undefined) =>
  useMockStore((s) => {
    if (!opportunityId) return null;
    const list = Object.values(s.diagnoses).filter((d) => d.opportunityId === opportunityId);
    if (list.length === 0) return null;
    return list.reduce((latest, d) => (d.createdAt > latest.createdAt ? d : latest));
  });

export const useDiagnosesForOpportunity = (opportunityId: string | undefined) =>
  useMockStore((s) => {
    if (!opportunityId) return [];
    return Object.values(s.diagnoses)
      .filter((d) => d.opportunityId === opportunityId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

export const useOutcomesForOpportunity = (opportunityId: string | undefined) =>
  useMockStore((s) => {
    if (!opportunityId) return [];
    return Object.values(s.outcomes)
      .filter((o) => o.opportunityId === opportunityId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

// --- Action accessors (stable refs; safe to use outside React) ---

export const mockActions = {
  hydrate: (input: HydrateInput) => useMockStore.getState().hydrate(input),
  reset: () => useMockStore.getState().reset(),
  setSession: (session: MockSession) => useMockStore.getState().setSession(session),
  clearSession: () => useMockStore.getState().clearSession(),
  completeOnboarding: () => useMockStore.getState().completeOnboarding(),
  addBuyer: (input: Parameters<MockActions['addBuyer']>[0]) =>
    useMockStore.getState().addBuyer(input),
  addOpportunity: (input: Parameters<MockActions['addOpportunity']>[0]) =>
    useMockStore.getState().addOpportunity(input),
  addInteraction: (input: Parameters<MockActions['addInteraction']>[0]) =>
    useMockStore.getState().addInteraction(input),
  runDiagnosis: (input: Parameters<MockActions['runDiagnosis']>[0]) =>
    useMockStore.getState().runDiagnosis(input),
  recordOutcome: (input: Parameters<MockActions['recordOutcome']>[0]) =>
    useMockStore.getState().recordOutcome(input),
  setAtRisk: (opportunityId: string, atRisk: boolean) =>
    useMockStore.getState().setAtRisk(opportunityId, atRisk),
};
