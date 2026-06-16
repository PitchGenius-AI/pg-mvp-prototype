import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trpc, type RouterOutputs } from '../trpc';
import { authClient } from '../auth-client';
import type { BuyerRow } from './buyer-rows';
import type { ExportPackRow } from './export-pack-rows';
import type { WorkbenchRow } from './workbench-rows';
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
import type {
  ImportActivitiesResult,
  ImportActivityRow,
  ImportBuyerRow,
  ImportResult,
} from './store';

// Hook layer (M29 cutover). Every component imports from here. The read hooks now
// hit the real backend via the tRPC React client; auth/session compose Better
// Auth's cookie session with workspace.getCurrent. The golden-path write hooks
// (add opportunity / add activity / run diagnosis) call real procedures. Surfaces
// not yet migrated in this pass (scripts/products CRUD, export, import, precall,
// outcomes, move-stage) use the deferred stubs at the bottom — their UI triggers
// are disabled until a follow-up wires them.

// --- Deferred-surface stubs (typed, no backend yet) ---

const DEFERRED_MESSAGE = 'This action is not available yet — it lands in a follow-up update.';

function useDeferredQuery<T>(key: string, value: T) {
  return useQuery({
    queryKey: ['deferred', key],
    queryFn: async () => value,
    staleTime: Infinity,
  });
}

function useDeferredMutation<TInput, TOutput>() {
  return useMutation<TOutput, Error, TInput>({
    mutationFn: async () => {
      throw new Error(DEFERRED_MESSAGE);
    },
  });
}

// --- Session / auth ---

// The composed session in the legacy MockSession shape: Better Auth user +
// workspace id + onboarding status from workspace.getCurrent.
export function useSession() {
  const auth = authClient.useSession();
  const ws = trpc.workspace.getCurrent.useQuery(undefined, { enabled: !!auth.data });
  const data: MockSession | null = auth.data
    ? {
        user: {
          id: auth.data.user.id,
          name: auth.data.user.name,
          email: auth.data.user.email,
        },
        workspaceId: ws.data?.workspace.id ?? '',
        workspaceOnboardingCompleted: ws.data?.workspace.onboardingCompleted ?? false,
      }
    : null;
  const isLoading = auth.isPending || (!!auth.data && ws.isLoading);
  return { data, isLoading } as const;
}

// --- Queries ---

export function useCurrentWorkspace() {
  return trpc.workspace.getCurrent.useQuery(undefined, {
    select: (d): MockWorkspace | null => d?.workspace ?? null,
  });
}

export function useProducts() {
  return trpc.product.list.useQuery(undefined) as unknown as ReturnType<
    typeof useQuery<MockProduct[]>
  >;
}

export function usePrimaryProduct() {
  return trpc.workspace.getCurrent.useQuery(undefined, {
    select: (d): MockProduct | null => d?.primaryProduct ?? null,
  });
}

// Back-compat alias for M3–M6 surfaces written against single-product workspaces.
export const useCurrentProduct = usePrimaryProduct;

export function useBuyers() {
  return trpc.buyer.list.useQuery(undefined) as unknown as ReturnType<typeof useQuery<MockBuyer[]>>;
}

export function useBuyerDirectory() {
  return trpc.buyer.directory.useQuery(undefined, { retry: false }) as unknown as ReturnType<
    typeof useQuery<BuyerRow[]>
  >;
}

export function useScriptTemplates() {
  return useDeferredQuery<MockScriptTemplate[]>('scriptTemplates', []);
}

export function useImportMappings() {
  return useDeferredQuery<MockImportMapping[]>('importMappings', []);
}

export function useOpportunities() {
  return trpc.opportunity.list.useQuery(undefined) as unknown as ReturnType<
    typeof useQuery<MockOpportunity[]>
  >;
}

export function useWorkbench() {
  return trpc.workbench.rows.useQuery(undefined, { retry: false }) as unknown as ReturnType<
    typeof useQuery<WorkbenchRow[]>
  >;
}

export function useOpportunity(id: string | undefined) {
  return trpc.opportunity.get.useQuery(
    { id: id ?? '' },
    { enabled: id !== undefined },
  ) as unknown as ReturnType<typeof useQuery<MockOpportunity | null>>;
}

export function useActivities(opportunityId: string | undefined) {
  return trpc.activity.listForOpportunity.useQuery(
    { opportunityId: opportunityId ?? '' },
    { enabled: opportunityId !== undefined },
  ) as unknown as ReturnType<typeof useQuery<MockActivity[]>>;
}

export function useDiagnosis(_diagnosisId: string | undefined) {
  // No get-by-id endpoint; detail surfaces read the latest per opportunity.
  return useDeferredQuery<MockDiagnosis | null>('diagnosisById', null);
}

export function useLatestDiagnosis(opportunityId: string | undefined) {
  return trpc.diagnosis.latestForOpportunity.useQuery(
    { opportunityId: opportunityId ?? '' },
    { enabled: opportunityId !== undefined },
  ) as unknown as ReturnType<typeof useQuery<MockDiagnosis | null>>;
}

export function useDiagnoses(opportunityId: string | undefined) {
  return trpc.diagnosis.listForOpportunity.useQuery(
    { opportunityId: opportunityId ?? '' },
    { enabled: opportunityId !== undefined },
  ) as unknown as ReturnType<typeof useQuery<MockDiagnosis[]>>;
}

export type DiagnosisJob = RouterOutputs['diagnosis']['jobsForOpportunity'][number];

// A background diagnosis run is treated as orphaned after this long (e.g. the API
// process restarted mid-run, in dev), so a stuck 'running' job surfaces as failed
// rather than spinning forever — and the poll can stop.
export const DIAGNOSIS_JOB_STALE_MS = 3 * 60 * 1000;

export function isDiagnosisJobActive(job: DiagnosisJob, now: number): boolean {
  return (
    job.status === 'running' && now - new Date(job.createdAt).getTime() < DIAGNOSIS_JOB_STALE_MS
  );
}

// The recent background diagnosis jobs for an opportunity. Polls every 2s while any
// job is still actively running, then stops. Drives the Activity tab's live "running /
// failed" state without blocking the add-activity flow on the AI chain.
export function useDiagnosisJobs(opportunityId: string | undefined) {
  return trpc.diagnosis.jobsForOpportunity.useQuery(
    { opportunityId: opportunityId ?? '' },
    {
      enabled: opportunityId !== undefined,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return false;
        const now = Date.now();
        return data.some((j) => isDiagnosisJobActive(j, now)) ? 2000 : false;
      },
    },
  );
}

export function useOutcomes(_opportunityId: string | undefined) {
  return useDeferredQuery<MockOutcome[]>('outcomes', []);
}

export function usePrecallIntelligence(opportunityId: string | undefined) {
  return trpc.precall.forOpportunity.useQuery(
    { opportunityId: opportunityId ?? '' },
    { enabled: opportunityId !== undefined, retry: false },
  ) as unknown as ReturnType<typeof useQuery<MockPrecallIntelligence | null>>;
}

// Generate (or regenerate) the pre-call intelligence bundle for an opportunity.
export function useRunPrecall() {
  const utils = trpc.useUtils();
  return trpc.precall.run.useMutation({
    onSuccess: (p) => utils.precall.forOpportunity.invalidate({ opportunityId: p.opportunityId }),
  });
}

// Persist rep edits to the generated script's sections.
export function useUpdatePrecallScript() {
  const utils = trpc.useUtils();
  return trpc.precall.updateScript.useMutation({
    onSuccess: (p) => utils.precall.forOpportunity.invalidate({ opportunityId: p.opportunityId }),
  });
}

export function useExportTimestamp(_opportunityId: string | undefined) {
  return useDeferredQuery<string | null>('exportTimestamp', null);
}

export function useExportPack() {
  return useDeferredQuery<ExportPackRow[]>('exportPack', []);
}

// --- Golden-path mutations ---

// Flat add-activity input the Activity tab already passes (checklist booleans at
// the top level); remapped to the nested tRPC shape here.
export interface AddActivityInput {
  workspaceId: string;
  opportunityId: string;
  activityType: MockActivity['activityType'];
  activityDate: string;
  participants?: string[];
  transcriptOrNotes?: string | null;
  repSubjectiveNotes?: string | null;
  nextStepAgreed?: boolean;
  stakeholderAdded?: boolean;
  pricingDiscussed?: boolean;
  budgetDiscussed?: boolean;
  competitorDiscussed?: boolean;
  implementationDiscussed?: boolean;
  securityDiscussed?: boolean;
}

export interface AddOpportunityHookInput {
  buyer?: {
    firstName: string;
    lastName?: string;
    title?: string;
    company: string;
    email?: string;
    linkedin?: string;
  };
  opportunity: {
    workspaceId: string;
    buyerId?: string;
    productId?: string;
    name: string;
    currentCrmStage: string;
    value?: number;
    expectedCloseDate?: string;
    knownPain?: string;
    knownObjection?: string;
    dealNotes?: string;
  };
}

export function useAddOpportunity() {
  const utils = trpc.useUtils();
  return trpc.opportunity.create.useMutation({
    onSuccess: () => {
      utils.opportunity.list.invalidate();
      utils.buyer.list.invalidate();
      utils.buyer.directory.invalidate();
      utils.workbench.rows.invalidate();
    },
  });
}

export function useAddActivity() {
  const utils = trpc.useUtils();
  const mutation = trpc.activity.create.useMutation({
    onSuccess: (activity) => {
      utils.activity.listForOpportunity.invalidate({ opportunityId: activity.opportunityId });
      utils.workbench.rows.invalidate();
    },
  });
  // Preserve the flat call-site shape: remap to the nested tRPC input.
  return {
    ...mutation,
    mutateAsync: (input: AddActivityInput) =>
      mutation.mutateAsync({
        opportunityId: input.opportunityId,
        activityType: input.activityType,
        activityDate: input.activityDate,
        participants: input.participants,
        transcriptOrNotes: input.transcriptOrNotes ?? undefined,
        repSubjectiveNotes: input.repSubjectiveNotes ?? undefined,
        checklist: {
          nextStepAgreed: input.nextStepAgreed,
          stakeholderAdded: input.stakeholderAdded,
          pricingDiscussed: input.pricingDiscussed,
          budgetDiscussed: input.budgetDiscussed,
          competitorDiscussed: input.competitorDiscussed,
          implementationDiscussed: input.implementationDiscussed,
          securityDiscussed: input.securityDiscussed,
        },
      }),
  };
}

export function useDeleteActivity() {
  const utils = trpc.useUtils();
  return trpc.activity.delete.useMutation({
    onSuccess: ({ opportunityId }) => {
      // Removing an activity also removes its diagnosis and may change the
      // opportunity's denormalized readiness — invalidate every surface that reads it.
      utils.activity.listForOpportunity.invalidate({ opportunityId });
      utils.diagnosis.listForOpportunity.invalidate({ opportunityId });
      utils.diagnosis.latestForOpportunity.invalidate({ opportunityId });
      utils.opportunity.get.invalidate({ id: opportunityId });
      utils.opportunity.list.invalidate();
      utils.workbench.rows.invalidate();
    },
  });
}

// Kick off a background diagnosis run. Returns as soon as the job is enqueued; the
// Activity tab's `useDiagnosisJobs` poll then drives the live status. On enqueue we
// invalidate the jobs query so the "Diagnosing…" state appears immediately.
export function useEnqueueDiagnosis() {
  const utils = trpc.useUtils();
  return trpc.diagnosis.enqueue.useMutation({
    onSuccess: (job) => {
      utils.diagnosis.jobsForOpportunity.invalidate({ opportunityId: job.opportunityId });
    },
  });
}

export function useRunDiagnosis() {
  const utils = trpc.useUtils();
  return trpc.diagnosis.run.useMutation({
    onSuccess: (diagnosis) => {
      utils.opportunity.list.invalidate();
      utils.opportunity.get.invalidate({ id: diagnosis.opportunityId });
      utils.workbench.rows.invalidate();
      utils.diagnosis.latestForOpportunity.invalidate({ opportunityId: diagnosis.opportunityId });
      utils.diagnosis.listForOpportunity.invalidate({ opportunityId: diagnosis.opportunityId });
    },
  });
}

// --- Deferred mutations (UI triggers disabled until a follow-up wires them) ---

export const useAssignBuyersToProduct = () =>
  useDeferredMutation<{ buyerIds: string[]; productId: string }, MockOpportunity[]>();
export const useAddBuyer = () => useDeferredMutation<unknown, MockBuyer>();
export const useMoveOpportunityStage = () =>
  useDeferredMutation<{ opportunityId: string; stage: string }, MockOpportunity>();
export const useRecordOutcome = () => useDeferredMutation<unknown, MockOutcome>();
export const useAddProduct = () =>
  useDeferredMutation<{ workspaceId: string; product: unknown }, MockProduct>();
export const useUpdateProduct = () =>
  useDeferredMutation<{ productId: string; patch: unknown }, MockProduct | null>();
export const useSetPrimaryProduct = () => useDeferredMutation<string, void>();
export const useAddScriptTemplate = () =>
  useDeferredMutation<{ workspaceId: string; template: unknown }, MockScriptTemplate>();
export const useUpdateScriptTemplate = () =>
  useDeferredMutation<{ scriptTemplateId: string; patch: unknown }, MockScriptTemplate | null>();
export const useSetPrimaryScriptTemplate = () => useDeferredMutation<string, void>();
export const useRecordExport = () => useDeferredMutation<string, string>();
export const useRecordExportPack = () => useDeferredMutation<string[], string[]>();
export const useAddImportMapping = () =>
  useDeferredMutation<{ workspaceId: string; mapping: unknown }, MockImportMapping>();
export const useImportBuyerRows = () =>
  useDeferredMutation<{ productId: string | null; rows: ImportBuyerRow[] }, ImportResult>();
export const useImportActivities = () =>
  useDeferredMutation<{ rows: ImportActivityRow[] }, ImportActivitiesResult>();

// --- Session-only mutations ---

// Sign out via Better Auth, then clear the query cache.
export function useClearSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: () => {
      qc.clear();
    },
  });
}

// Onboarding completion is committed by the wizard via trpc.workspace.completeOnboarding;
// this hook just refreshes the session-derived queries afterward.
export function useCompleteOnboarding() {
  const utils = trpc.useUtils();
  return useMutation({
    mutationFn: async () => {
      await utils.workspace.getCurrent.invalidate();
    },
  });
}
