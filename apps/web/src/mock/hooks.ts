import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mockApi } from './mock-api';
import { queryKeys } from './queries';
import { useMockStore } from './store';
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

// Hook layer. Components import from here, never from `./store` directly, so when
// the real tRPC client lands the only file that changes is this one — the
// component-facing hook names + return shapes stay identical.

// --- Queries ---

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: () => mockApi<MockSession | null>(() => useMockStore.getState().session),
  });
}

export function useCurrentWorkspace() {
  return useQuery({
    queryKey: queryKeys.workspace.current,
    queryFn: () =>
      mockApi<MockWorkspace | null>(() => {
        const s = useMockStore.getState();
        return s.session ? s.workspaces[s.session.workspaceId] ?? null : null;
      }),
  });
}

export function useCurrentProduct() {
  return useQuery({
    queryKey: queryKeys.product.forCurrentWorkspace,
    queryFn: () =>
      mockApi<MockProduct | null>(() => {
        const s = useMockStore.getState();
        if (!s.session) return null;
        return (
          Object.values(s.products).find((p) => p.workspaceId === s.session?.workspaceId) ?? null
        );
      }),
  });
}

export function useOpportunities() {
  return useQuery({
    queryKey: queryKeys.opportunity.list(),
    queryFn: () =>
      mockApi<MockOpportunity[]>(() => {
        const s = useMockStore.getState();
        if (!s.session) return [];
        const workspaceId = s.session.workspaceId;
        return Object.values(s.opportunities)
          .filter((o) => o.workspaceId === workspaceId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }),
  });
}

export function useOpportunity(id: string | undefined) {
  return useQuery({
    queryKey: id ? queryKeys.opportunity.byId(id) : ['opportunity', 'byId', 'noop'],
    enabled: id !== undefined,
    queryFn: () =>
      mockApi<MockOpportunity | null>(() =>
        id ? useMockStore.getState().opportunities[id] ?? null : null,
      ),
  });
}

export function useInteractions(opportunityId: string | undefined) {
  return useQuery({
    queryKey: opportunityId
      ? queryKeys.interaction.forOpportunity(opportunityId)
      : ['interaction', 'forOpportunity', 'noop'],
    enabled: opportunityId !== undefined,
    queryFn: () =>
      mockApi<MockInteraction[]>(() => {
        if (!opportunityId) return [];
        return Object.values(useMockStore.getState().interactions)
          .filter((i) => i.opportunityId === opportunityId)
          .sort((a, b) => b.interactionDate.localeCompare(a.interactionDate));
      }),
  });
}

export function useDiagnosis(diagnosisId: string | undefined) {
  return useQuery({
    queryKey: diagnosisId
      ? queryKeys.diagnosis.byId(diagnosisId)
      : ['diagnosis', 'byId', 'noop'],
    enabled: diagnosisId !== undefined,
    queryFn: () =>
      mockApi<MockDiagnosis | null>(() =>
        diagnosisId ? useMockStore.getState().diagnoses[diagnosisId] ?? null : null,
      ),
  });
}

export function useLatestDiagnosis(opportunityId: string | undefined) {
  return useQuery({
    queryKey: opportunityId
      ? queryKeys.diagnosis.latestForOpportunity(opportunityId)
      : ['diagnosis', 'latestForOpportunity', 'noop'],
    enabled: opportunityId !== undefined,
    queryFn: () =>
      mockApi<MockDiagnosis | null>(() => {
        if (!opportunityId) return null;
        const list = Object.values(useMockStore.getState().diagnoses).filter(
          (d) => d.opportunityId === opportunityId,
        );
        if (list.length === 0) return null;
        return list.reduce((latest, d) => (d.createdAt > latest.createdAt ? d : latest));
      }),
  });
}

export function useDiagnoses(opportunityId: string | undefined) {
  return useQuery({
    queryKey: opportunityId
      ? queryKeys.diagnosis.listForOpportunity(opportunityId)
      : ['diagnosis', 'listForOpportunity', 'noop'],
    enabled: opportunityId !== undefined,
    queryFn: () =>
      mockApi<MockDiagnosis[]>(() => {
        if (!opportunityId) return [];
        return Object.values(useMockStore.getState().diagnoses)
          .filter((d) => d.opportunityId === opportunityId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }),
  });
}

export function useOutcomes(opportunityId: string | undefined) {
  return useQuery({
    queryKey: opportunityId
      ? queryKeys.outcome.forOpportunity(opportunityId)
      : ['outcome', 'forOpportunity', 'noop'],
    enabled: opportunityId !== undefined,
    queryFn: () =>
      mockApi<MockOutcome[]>(() => {
        if (!opportunityId) return [];
        return Object.values(useMockStore.getState().outcomes)
          .filter((o) => o.opportunityId === opportunityId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }),
  });
}

// --- Mutations ---

type AddOpportunityInput = Parameters<
  ReturnType<typeof useMockStore.getState>['addOpportunity']
>[0];
type AddBuyerInput = Parameters<ReturnType<typeof useMockStore.getState>['addBuyer']>[0];
type AddInteractionInput = Parameters<
  ReturnType<typeof useMockStore.getState>['addInteraction']
>[0];
type RunDiagnosisInput = Parameters<
  ReturnType<typeof useMockStore.getState>['runDiagnosis']
>[0];
type RecordOutcomeInput = Parameters<
  ReturnType<typeof useMockStore.getState>['recordOutcome']
>[0];

export function useAddOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { buyer?: AddBuyerInput; opportunity: Omit<AddOpportunityInput, 'buyerId'> & { buyerId?: string } }) =>
      mockApi<MockOpportunity>(() => {
        const state = useMockStore.getState();
        let buyerId = input.opportunity.buyerId;
        if (!buyerId) {
          if (!input.buyer) {
            throw new Error('Must supply either an existing buyerId or a new buyer to create');
          }
          buyerId = state.addBuyer(input.buyer).id;
        }
        return state.addOpportunity({ ...input.opportunity, buyerId });
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.opportunity.all });
    },
  });
}

export function useAddBuyer() {
  return useMutation({
    mutationFn: (input: AddBuyerInput) =>
      mockApi<MockBuyer>(() => useMockStore.getState().addBuyer(input)),
  });
}

export function useAddInteraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddInteractionInput) =>
      mockApi<MockInteraction>(() => useMockStore.getState().addInteraction(input)),
    onSuccess: (interaction) => {
      qc.invalidateQueries({
        queryKey: queryKeys.interaction.forOpportunity(interaction.opportunityId),
      });
    },
  });
}

export function useRunDiagnosis() {
  const qc = useQueryClient();
  return useMutation({
    // "AI" call — uses the slower latency window so the UX shows a meaningful spinner.
    mutationFn: (input: RunDiagnosisInput) =>
      mockApi<MockDiagnosis>(() => useMockStore.getState().runDiagnosis(input), { slow: true }),
    onSuccess: (diagnosis) => {
      qc.invalidateQueries({ queryKey: queryKeys.opportunity.all });
      qc.invalidateQueries({
        queryKey: queryKeys.diagnosis.latestForOpportunity(diagnosis.opportunityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.diagnosis.listForOpportunity(diagnosis.opportunityId),
      });
    },
  });
}

export function useRecordOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecordOutcomeInput) =>
      mockApi<MockOutcome>(() => useMockStore.getState().recordOutcome(input)),
    onSuccess: (outcome) => {
      qc.invalidateQueries({
        queryKey: queryKeys.outcome.forOpportunity(outcome.opportunityId),
      });
      qc.invalidateQueries({ queryKey: queryKeys.opportunity.all });
    },
  });
}

// --- Session-only mutations (synchronous, no mockApi delay — matches the local-only
// nature of session changes in a real auth flow where the session is already on the client). ---

export function useSetSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: MockSession) => {
      useMockStore.getState().setSession(session);
      return session;
    },
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useClearSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      useMockStore.getState().clearSession();
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      useMockStore.getState().completeOnboarding();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.session });
      qc.invalidateQueries({ queryKey: queryKeys.workspace.current });
    },
  });
}
