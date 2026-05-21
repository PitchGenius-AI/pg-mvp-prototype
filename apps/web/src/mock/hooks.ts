import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mockApi } from './mock-api';
import { queryKeys } from './queries';
import {
  useMockStore,
  type ImportActivitiesResult,
  type ImportActivityRow,
  type ImportBuyerRow,
  type ImportResult,
} from './store';
import { buildBuyerRows, type BuyerRow } from './buyer-rows';
import { buildWorkbenchRows, type WorkbenchRow } from './workbench-rows';
import type {
  MockActivity,
  MockBuyer,
  MockDiagnosis,
  MockImportMapping,
  MockOpportunity,
  MockOutcome,
  MockPrecallIntelligence,
  MockProduct,
  MockScriptTemplate,
  MockSession,
  MockWorkspace,
} from './types';

// Hook layer. Components import from here, never from `./store` directly, so when
// the real tRPC client lands the only file that changes is this one — the
// component-facing hook names + return shapes stay identical.

const workspaceProducts = (workspaceId: string): MockProduct[] =>
  Object.values(useMockStore.getState().products).filter(
    (p) => p.workspaceId === workspaceId,
  );

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

// Every product in the current workspace (multi-product as of M9).
export function useProducts() {
  return useQuery({
    queryKey: queryKeys.product.forCurrentWorkspace,
    queryFn: () =>
      mockApi<MockProduct[]>(() => {
        const s = useMockStore.getState();
        if (!s.session) return [];
        return workspaceProducts(s.session.workspaceId);
      }),
  });
}

// The primary product — default context for new opportunities.
export function usePrimaryProduct() {
  return useQuery({
    queryKey: queryKeys.product.primary,
    queryFn: () =>
      mockApi<MockProduct | null>(() => {
        const s = useMockStore.getState();
        if (!s.session) return null;
        const products = workspaceProducts(s.session.workspaceId);
        return products.find((p) => p.isPrimary) ?? products[0] ?? null;
      }),
  });
}

// Back-compat alias for M3–M6 surfaces written against single-product workspaces.
export const useCurrentProduct = usePrimaryProduct;

export function useBuyers() {
  return useQuery({
    queryKey: queryKeys.buyer.list(),
    queryFn: () =>
      mockApi<MockBuyer[]>(() => {
        const s = useMockStore.getState();
        if (!s.session) return [];
        const workspaceId = s.session.workspaceId;
        return Object.values(s.buyers)
          .filter((b) => b.workspaceId === workspaceId)
          .sort((a, b) => a.firstName.localeCompare(b.firstName));
      }),
  });
}

// The Buyers people-directory read-model (M13) — every buyer joined with its
// opportunity count + assigned/unassigned status. Backs the /buyers table.
export function useBuyerDirectory() {
  return useQuery({
    queryKey: queryKeys.buyer.directory(),
    // No retry: the injected-error demo path (window.__mockApi.setErrorRate)
    // should surface the error state immediately, not after backoff.
    retry: false,
    queryFn: () =>
      mockApi<BuyerRow[]>(() => {
        const s = useMockStore.getState();
        if (!s.session) return [];
        return buildBuyerRows(s.session.workspaceId);
      }),
  });
}

export function useScriptTemplates() {
  return useQuery({
    queryKey: queryKeys.scriptTemplate.list(),
    queryFn: () =>
      mockApi<MockScriptTemplate[]>(() => {
        const s = useMockStore.getState();
        if (!s.session) return [];
        return Object.values(s.scriptTemplates).filter(
          (t) => t.workspaceId === s.session?.workspaceId,
        );
      }),
  });
}

export function useImportMappings() {
  return useQuery({
    queryKey: queryKeys.importMapping.list(),
    queryFn: () =>
      mockApi<MockImportMapping[]>(() => {
        const s = useMockStore.getState();
        if (!s.session) return [];
        return Object.values(s.importMappings).filter(
          (m) => m.workspaceId === s.session?.workspaceId,
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

// The Opportunity Workbench read-model (M12) — opportunities joined with buyer,
// product, latest activity + diagnosis. One fetch backs both Board and List.
export function useWorkbench() {
  return useQuery({
    queryKey: queryKeys.workbench.rows(),
    // No retry: the injected-error demo path (window.__mockApi.setErrorRate)
    // should surface the error state immediately, not after backoff.
    retry: false,
    queryFn: () =>
      mockApi<WorkbenchRow[]>(() => {
        const s = useMockStore.getState();
        if (!s.session) return [];
        return buildWorkbenchRows(s.session.workspaceId);
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

export function useActivities(opportunityId: string | undefined) {
  return useQuery({
    queryKey: opportunityId
      ? queryKeys.activity.forOpportunity(opportunityId)
      : ['activity', 'forOpportunity', 'noop'],
    enabled: opportunityId !== undefined,
    queryFn: () =>
      mockApi<MockActivity[]>(() => {
        if (!opportunityId) return [];
        return Object.values(useMockStore.getState().activities)
          .filter((a) => a.opportunityId === opportunityId)
          .sort((a, b) => b.activityDate.localeCompare(a.activityDate));
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

export function usePrecallIntelligence(opportunityId: string | undefined) {
  return useQuery({
    queryKey: opportunityId
      ? queryKeys.precall.forOpportunity(opportunityId)
      : ['precall', 'forOpportunity', 'noop'],
    enabled: opportunityId !== undefined,
    queryFn: () =>
      mockApi<MockPrecallIntelligence | null>(() => {
        if (!opportunityId) return null;
        return (
          Object.values(useMockStore.getState().precallIntelligence).find(
            (p) => p.opportunityId === opportunityId,
          ) ?? null
        );
      }),
  });
}

// --- Mutations ---

type Actions = ReturnType<typeof useMockStore.getState>;
type AddOpportunityInput = Parameters<Actions['addOpportunity']>[0];
type AddBuyerInput = Parameters<Actions['addBuyer']>[0];
type AddActivityInput = Parameters<Actions['addActivity']>[0];
type RunDiagnosisInput = Parameters<Actions['runDiagnosis']>[0];
type RecordOutcomeInput = Parameters<Actions['recordOutcome']>[0];
type AddProductInput = Parameters<Actions['addProduct']>[1];
type UpdateProductPatch = Parameters<Actions['updateProduct']>[1];
type AddScriptTemplateInput = Parameters<Actions['addScriptTemplate']>[1];
type UpdateScriptTemplatePatch = Parameters<Actions['updateScriptTemplate']>[1];
type SetPrecallInput = Parameters<Actions['setPrecallIntelligence']>[0];
type AddImportMappingInput = Parameters<Actions['addImportMapping']>[1];

export function useAddOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      buyer?: AddBuyerInput;
      opportunity: Omit<AddOpportunityInput, 'buyerId'> & { buyerId?: string };
    }) =>
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
      qc.invalidateQueries({ queryKey: queryKeys.buyer.all });
      qc.invalidateQueries({ queryKey: queryKeys.workbench.all });
    },
  });
}

// Turn unassigned buyers into opportunities by assigning a product (M13,
// PG-206/207). One buyer (per-row action) or many (bulk) in a single call.
export function useAssignBuyersToProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { buyerIds: string[]; productId: string }) =>
      mockApi<MockOpportunity[]>(() =>
        useMockStore.getState().assignBuyersToProduct(input.buyerIds, input.productId),
      ),
    onSuccess: () => {
      // New opportunities re-derive the directory's assigned/unassigned status,
      // the workbench rows, and the workbench's unassigned-buyers banner count.
      qc.invalidateQueries({ queryKey: queryKeys.buyer.all });
      qc.invalidateQueries({ queryKey: queryKeys.opportunity.all });
      qc.invalidateQueries({ queryKey: queryKeys.workbench.all });
    },
  });
}

export function useAddBuyer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddBuyerInput) =>
      mockApi<MockBuyer>(() => useMockStore.getState().addBuyer(input)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.buyer.all });
    },
  });
}

export function useAddActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddActivityInput) =>
      mockApi<MockActivity>(() => useMockStore.getState().addActivity(input)),
    onSuccess: (activity) => {
      qc.invalidateQueries({
        queryKey: queryKeys.activity.forOpportunity(activity.opportunityId),
      });
      // Workbench rows carry each opportunity's latest-activity date.
      qc.invalidateQueries({ queryKey: queryKeys.workbench.all });
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
      // A new diagnosis re-denormalizes readiness + alignment onto the board.
      qc.invalidateQueries({ queryKey: queryKeys.workbench.all });
      qc.invalidateQueries({
        queryKey: queryKeys.diagnosis.latestForOpportunity(diagnosis.opportunityId),
      });
      qc.invalidateQueries({
        queryKey: queryKeys.diagnosis.listForOpportunity(diagnosis.opportunityId),
      });
    },
  });
}

// Workbench board drag-to-stage (M12, PG-201). Synchronous local update — a drag
// must feel instant — so it skips the mockApi latency window. onSuccess patches
// the workbench cache directly: the card lands in its new column with no
// refetch flicker, and the alignment re-check (done in the store action) shows.
export function useMoveOpportunityStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { opportunityId: string; stage: string }) =>
      useMockStore.getState().moveOpportunityToStage(input.opportunityId, input.stage),
    onSuccess: (updated) => {
      if (!updated) return;
      qc.setQueryData<WorkbenchRow[]>(queryKeys.workbench.rows(), (rows) =>
        rows?.map((r) =>
          r.opportunity.id === updated.id ? { ...r, opportunity: updated } : r,
        ),
      );
      qc.invalidateQueries({ queryKey: queryKeys.opportunity.all });
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
      qc.invalidateQueries({ queryKey: queryKeys.workbench.all });
    },
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; product: AddProductInput }) =>
      mockApi<MockProduct>(() =>
        useMockStore.getState().addProduct(input.workspaceId, input.product),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.product.all });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string; patch: UpdateProductPatch }) =>
      mockApi<MockProduct | null>(() =>
        useMockStore.getState().updateProduct(input.productId, input.patch),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.product.all });
    },
  });
}

export function useSetPrimaryProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) =>
      mockApi<void>(() => useMockStore.getState().setPrimaryProduct(productId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.product.all });
    },
  });
}

export function useAddScriptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; template: AddScriptTemplateInput }) =>
      mockApi<MockScriptTemplate>(() =>
        useMockStore.getState().addScriptTemplate(input.workspaceId, input.template),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scriptTemplate.all });
    },
  });
}

export function useUpdateScriptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { scriptTemplateId: string; patch: UpdateScriptTemplatePatch }) =>
      mockApi<MockScriptTemplate | null>(() =>
        useMockStore.getState().updateScriptTemplate(input.scriptTemplateId, input.patch),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scriptTemplate.all });
    },
  });
}

export function useSetPrimaryScriptTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scriptTemplateId: string) =>
      mockApi<void>(() =>
        useMockStore.getState().setPrimaryScriptTemplate(scriptTemplateId),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.scriptTemplate.all });
    },
  });
}

export function useSetPrecallIntelligence() {
  const qc = useQueryClient();
  return useMutation({
    // "AI" enrichment call — slower latency window for a meaningful spinner.
    mutationFn: (input: SetPrecallInput) =>
      mockApi<MockPrecallIntelligence>(
        () => useMockStore.getState().setPrecallIntelligence(input),
        { slow: true },
      ),
    onSuccess: (precall) => {
      qc.invalidateQueries({
        queryKey: queryKeys.precall.forOpportunity(precall.opportunityId),
      });
    },
  });
}

export function useAddImportMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { workspaceId: string; mapping: AddImportMappingInput }) =>
      mockApi<MockImportMapping>(() =>
        useMockStore.getState().addImportMapping(input.workspaceId, input.mapping),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.importMapping.all });
    },
  });
}

// Bulk Daily Workbench import (M14, PG-212). Commits the confirmed, mapped rows
// in one transactional store write, then invalidates every read-model the
// import touches — the workbench, the buyers directory, the unassigned banner.
export function useImportBuyerRows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: string | null; rows: ImportBuyerRow[] }) =>
      mockApi<ImportResult>(() => {
        const s = useMockStore.getState();
        if (!s.session) throw new Error('No active session');
        return s.importBuyerRows({
          workspaceId: s.session.workspaceId,
          ownerUserId: s.session.user.id,
          productId: input.productId,
          rows: input.rows,
        });
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.buyer.all });
      qc.invalidateQueries({ queryKey: queryKeys.opportunity.all });
      qc.invalidateQueries({ queryKey: queryKeys.workbench.all });
    },
  });
}

// Bulk Activities import + auto-join (M15, PG-216/217/218). One slow "AI" call:
// it creates the activities, auto-joins them to opportunities by CRM Record ID,
// and re-scores every opportunity that gained an activity. Invalidates every
// read-model the rescoring touches.
export function useImportActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { rows: ImportActivityRow[] }) =>
      mockApi<ImportActivitiesResult>(
        () => {
          const s = useMockStore.getState();
          if (!s.session) throw new Error('No active session');
          return s.importActivities({
            workspaceId: s.session.workspaceId,
            rows: input.rows,
          });
        },
        { slow: true },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.opportunity.all });
      qc.invalidateQueries({ queryKey: queryKeys.workbench.all });
      qc.invalidateQueries({ queryKey: queryKeys.activity.all });
      qc.invalidateQueries({ queryKey: queryKeys.diagnosis.all });
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
