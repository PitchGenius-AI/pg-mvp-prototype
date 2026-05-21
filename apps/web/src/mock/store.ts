import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { computePipelineRealityCheck } from './fake-diagnosis';
import { createInitialOnboardingDraft } from './types';
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
  OnboardingDraft,
} from './types';

interface MockState {
  session: MockSession | null;
  workspaces: Record<string, MockWorkspace>;
  products: Record<string, MockProduct>;
  buyers: Record<string, MockBuyer>;
  opportunities: Record<string, MockOpportunity>;
  activities: Record<string, MockActivity>;
  diagnoses: Record<string, MockDiagnosis>;
  outcomes: Record<string, MockOutcome>;
  scriptTemplates: Record<string, MockScriptTemplate>;
  precallIntelligence: Record<string, MockPrecallIntelligence>;
  importMappings: Record<string, MockImportMapping>;
  // In-progress onboarding wizard state (M10). Per-step edits land here so the
  // flow survives in-app navigation; committed to real entities on finish.
  onboardingDraft: OnboardingDraft;
}

export interface HydrateInput {
  workspaces: MockWorkspace[];
  products: MockProduct[];
  buyers: MockBuyer[];
  opportunities: MockOpportunity[];
  activities: MockActivity[];
  diagnoses: MockDiagnosis[];
  outcomes: MockOutcome[];
  scriptTemplates: MockScriptTemplate[];
  precallIntelligence: MockPrecallIntelligence[];
  importMappings: MockImportMapping[];
}

interface MockActions {
  hydrate: (input: HydrateInput) => void;
  reset: () => void;

  setSession: (session: MockSession) => void;
  clearSession: () => void;
  completeOnboarding: () => void;
  activateSubscription: () => void;

  updateOnboardingDraft: (patch: Partial<OnboardingDraft>) => void;
  resetOnboardingDraft: () => void;

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
      | 'crmRecordId'
    > &
      Partial<Pick<MockOpportunity, 'atRisk' | 'closedStatus' | 'crmRecordId'>>,
  ) => MockOpportunity;
  addActivity: (input: Omit<MockActivity, 'id' | 'createdAt' | 'updatedAt'>) => MockActivity;
  runDiagnosis: (input: Omit<MockDiagnosis, 'id' | 'createdAt'>) => MockDiagnosis;
  recordOutcome: (input: Omit<MockOutcome, 'id' | 'createdAt'>) => MockOutcome;
  setAtRisk: (opportunityId: string, atRisk: boolean) => void;
  // Drag-to-stage on the Workbench board (M12, PG-201). Updates the CRM stage and
  // re-runs the alignment check against the unchanged readiness state.
  moveOpportunityToStage: (
    opportunityId: string,
    newStage: string,
  ) => MockOpportunity | null;
  // Assign one or more unassigned buyers to a product (M13, PG-206/207). Each
  // buyer becomes a new open opportunity, which removes it from the "unassigned"
  // set (a buyer is unassigned precisely when it has no opportunity). Returns the
  // opportunities created, skipping any buyer id that doesn't resolve.
  assignBuyersToProduct: (buyerIds: string[], productId: string) => MockOpportunity[];

  addWorkspace: (
    input: Pick<MockWorkspace, 'name' | 'createdByUserId'> &
      Partial<
        Pick<MockWorkspace, 'crmStageTemplate' | 'onboardingCompleted' | 'subscriptionStatus' | 'crmType'>
      >,
  ) => MockWorkspace;
  updateWorkspace: (
    workspaceId: string,
    patch: Partial<
      Pick<
        MockWorkspace,
        | 'name'
        | 'website'
        | 'industry'
        | 'crmStageTemplate'
        | 'customCrmStages'
        | 'crmType'
        | 'subscriptionStatus'
      >
    >,
  ) => MockWorkspace | null;

  addProduct: (
    workspaceId: string,
    input: Omit<MockProduct, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'isPrimary'> &
      Partial<Pick<MockProduct, 'isPrimary'>>,
  ) => MockProduct;
  updateProduct: (
    productId: string,
    patch: Partial<Pick<MockProduct, 'name' | 'description' | 'targetBuyer' | 'problemSolved'>>,
  ) => MockProduct | null;
  setPrimaryProduct: (productId: string) => void;
  // Legacy onboarding helper (M3) — creates the workspace's first product as the
  // primary, or updates the existing one. Superseded by addProduct in M10/M16.
  upsertProductForWorkspace: (
    workspaceId: string,
    input: Omit<MockProduct, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'isPrimary'>,
  ) => MockProduct;

  addScriptTemplate: (
    workspaceId: string,
    input: Omit<MockScriptTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'isPrimary'> &
      Partial<Pick<MockScriptTemplate, 'isPrimary'>>,
  ) => MockScriptTemplate;
  updateScriptTemplate: (
    scriptTemplateId: string,
    patch: Partial<Pick<MockScriptTemplate, 'name' | 'content'>>,
  ) => MockScriptTemplate | null;
  setPrimaryScriptTemplate: (scriptTemplateId: string) => void;

  setPrecallIntelligence: (
    input: Omit<MockPrecallIntelligence, 'id' | 'generatedAt'>,
  ) => MockPrecallIntelligence;

  addImportMapping: (
    workspaceId: string,
    input: Omit<MockImportMapping, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>,
  ) => MockImportMapping;
}

const emptyState: Omit<MockState, 'onboardingDraft'> = {
  session: null,
  workspaces: {},
  products: {},
  buyers: {},
  opportunities: {},
  activities: {},
  diagnoses: {},
  outcomes: {},
  scriptTemplates: {},
  precallIntelligence: {},
  importMappings: {},
};

// Always produce a fresh draft (own array refs) alongside the empty entity maps.
const freshState = (): MockState => ({
  ...emptyState,
  onboardingDraft: createInitialOnboardingDraft(),
});

const newId = (prefix: string) =>
  `${prefix}_${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(
    /-/g,
    '',
  )}`;

const nowIso = () => new Date().toISOString();

export const useMockStore = create<MockState & MockActions>()(
  devtools(
    (set, get) => ({
      ...freshState(),

      hydrate: (input) =>
        set(
          () => ({
            workspaces: Object.fromEntries(input.workspaces.map((w) => [w.id, w])),
            products: Object.fromEntries(input.products.map((p) => [p.id, p])),
            buyers: Object.fromEntries(input.buyers.map((b) => [b.id, b])),
            opportunities: Object.fromEntries(input.opportunities.map((o) => [o.id, o])),
            activities: Object.fromEntries(input.activities.map((a) => [a.id, a])),
            diagnoses: Object.fromEntries(input.diagnoses.map((d) => [d.id, d])),
            outcomes: Object.fromEntries(input.outcomes.map((o) => [o.id, o])),
            scriptTemplates: Object.fromEntries(input.scriptTemplates.map((s) => [s.id, s])),
            precallIntelligence: Object.fromEntries(
              input.precallIntelligence.map((p) => [p.id, p]),
            ),
            importMappings: Object.fromEntries(input.importMappings.map((m) => [m.id, m])),
          }),
          undefined,
          'mock/hydrate',
        ),

      reset: () => set(() => freshState(), undefined, 'mock/reset'),

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
              // Wizard is done — drop the draft so a future signup starts clean.
              onboardingDraft: createInitialOnboardingDraft(),
            };
          },
          undefined,
          'mock/completeOnboarding',
        ),

      // Post-payment flow (M11, PG-198). Successful mock checkout flips the
      // workspace to `active` — the flag the hard-paywall guards read.
      activateSubscription: () =>
        set(
          (state) => {
            if (!state.session) return state;
            const workspace = state.workspaces[state.session.workspaceId];
            if (!workspace) return state;
            return {
              workspaces: {
                ...state.workspaces,
                [workspace.id]: {
                  ...workspace,
                  subscriptionStatus: 'active',
                  updatedAt: nowIso(),
                },
              },
            };
          },
          undefined,
          'mock/activateSubscription',
        ),

      updateOnboardingDraft: (patch) =>
        set(
          (state) => ({ onboardingDraft: { ...state.onboardingDraft, ...patch } }),
          undefined,
          'mock/updateOnboardingDraft',
        ),

      resetOnboardingDraft: () =>
        set(
          () => ({ onboardingDraft: createInitialOnboardingDraft() }),
          undefined,
          'mock/resetOnboardingDraft',
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
          crmRecordId: input.crmRecordId ?? null,
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

      addActivity: (input) => {
        const activity: MockActivity = {
          ...input,
          id: newId('act'),
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => ({
            activities: { ...state.activities, [activity.id]: activity },
          }),
          undefined,
          'mock/addActivity',
        );
        return activity;
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

      moveOpportunityToStage: (opportunityId, newStage) => {
        let updated: MockOpportunity | null = null;
        set(
          (state) => {
            const opp = state.opportunities[opportunityId];
            if (!opp || opp.currentCrmStage === newStage) return state;
            // Re-run the Pipeline Reality Check against the unchanged readiness
            // state (PG-201) — the buyer's evidence hasn't moved, only the rep's
            // CRM stage. With no diagnosis yet, alignment stays null.
            const alignment = opp.currentReadinessState
              ? computePipelineRealityCheck(newStage, opp.currentReadinessState)
              : null;
            updated = {
              ...opp,
              currentCrmStage: newStage,
              currentAlignmentOutcome: alignment?.outcome ?? opp.currentAlignmentOutcome,
              currentAlignmentLevel: alignment?.level ?? opp.currentAlignmentLevel,
              updatedAt: nowIso(),
            };
            return {
              opportunities: { ...state.opportunities, [opportunityId]: updated },
            };
          },
          undefined,
          'mock/moveOpportunityToStage',
        );
        return updated;
      },

      assignBuyersToProduct: (buyerIds, productId) => {
        const state = get();
        const product = state.products[productId];
        const ownerUserId = state.session?.user.id;
        if (!product || !ownerUserId) return [];

        const created: MockOpportunity[] = [];
        for (const buyerId of buyerIds) {
          const buyer = state.buyers[buyerId];
          if (!buyer) continue;
          created.push({
            id: newId('opp'),
            workspaceId: buyer.workspaceId,
            buyerId,
            productId,
            ownerUserId,
            // Auto-named from the buyer's company + the product — the rep can
            // rename it later on the opportunity detail.
            opportunityName: `${buyer.company} – ${product.name}`,
            // No import row to carry a stage from in M13, so the new opportunity
            // starts unstaged; M14's Daily Workbench import will carry it.
            currentCrmStage: '',
            opportunityValue: null,
            expectedCloseDate: null,
            knownPain: null,
            knownObjection: null,
            dealNotes: null,
            crmRecordId: null,
            currentReadinessState: null,
            currentReadinessScore: null,
            currentAlignmentOutcome: null,
            currentAlignmentLevel: null,
            atRisk: false,
            closedStatus: 'open',
            reframedFromOpportunityId: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
        }
        if (created.length === 0) return [];

        set(
          (s) => ({
            opportunities: {
              ...s.opportunities,
              ...Object.fromEntries(created.map((o) => [o.id, o])),
            },
          }),
          undefined,
          'mock/assignBuyersToProduct',
        );
        return created;
      },

      addWorkspace: (input) => {
        const workspace: MockWorkspace = {
          id: newId('ws'),
          name: input.name,
          website: null,
          industry: null,
          crmStageTemplate: input.crmStageTemplate ?? 'simple_b2b_sales',
          customCrmStages: null,
          crmType: input.crmType ?? null,
          subscriptionStatus: input.subscriptionStatus ?? 'none',
          createdByUserId: input.createdByUserId,
          onboardingCompleted: input.onboardingCompleted ?? false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => ({ workspaces: { ...state.workspaces, [workspace.id]: workspace } }),
          undefined,
          'mock/addWorkspace',
        );
        return workspace;
      },

      updateWorkspace: (workspaceId, patch) => {
        const existing = get().workspaces[workspaceId];
        if (!existing) return null;
        const updated: MockWorkspace = { ...existing, ...patch, updatedAt: nowIso() };
        set(
          (state) => ({
            workspaces: { ...state.workspaces, [workspaceId]: updated },
          }),
          undefined,
          'mock/updateWorkspace',
        );
        return updated;
      },

      addProduct: (workspaceId, input) => {
        const existing = Object.values(get().products).filter(
          (p) => p.workspaceId === workspaceId,
        );
        // First product in a workspace is always primary; otherwise honor the flag.
        const isPrimary = existing.length === 0 ? true : input.isPrimary ?? false;
        const product: MockProduct = {
          name: input.name,
          description: input.description,
          targetBuyer: input.targetBuyer,
          problemSolved: input.problemSolved,
          id: newId('prod'),
          workspaceId,
          isPrimary,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => {
            // A new primary demotes every other product in the workspace.
            const products = { ...state.products };
            if (isPrimary) {
              for (const p of Object.values(products)) {
                if (p.workspaceId === workspaceId && p.isPrimary) {
                  products[p.id] = { ...p, isPrimary: false, updatedAt: nowIso() };
                }
              }
            }
            products[product.id] = product;
            return { products };
          },
          undefined,
          'mock/addProduct',
        );
        return product;
      },

      updateProduct: (productId, patch) => {
        const existing = get().products[productId];
        if (!existing) return null;
        const updated: MockProduct = { ...existing, ...patch, updatedAt: nowIso() };
        set(
          (state) => ({ products: { ...state.products, [productId]: updated } }),
          undefined,
          'mock/updateProduct',
        );
        return updated;
      },

      setPrimaryProduct: (productId) =>
        set(
          (state) => {
            const target = state.products[productId];
            if (!target) return state;
            const products = { ...state.products };
            for (const p of Object.values(products)) {
              if (p.workspaceId !== target.workspaceId) continue;
              const shouldBePrimary = p.id === productId;
              if (p.isPrimary !== shouldBePrimary) {
                products[p.id] = { ...p, isPrimary: shouldBePrimary, updatedAt: nowIso() };
              }
            }
            return { products };
          },
          undefined,
          'mock/setPrimaryProduct',
        ),

      upsertProductForWorkspace: (workspaceId, input) => {
        const existing = Object.values(get().products).find(
          (p) => p.workspaceId === workspaceId,
        );
        const product: MockProduct = existing
          ? { ...existing, ...input, updatedAt: nowIso() }
          : {
              ...input,
              id: newId('prod'),
              workspaceId,
              isPrimary: true,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            };
        set(
          (state) => ({ products: { ...state.products, [product.id]: product } }),
          undefined,
          'mock/upsertProductForWorkspace',
        );
        return product;
      },

      addScriptTemplate: (workspaceId, input) => {
        const existing = Object.values(get().scriptTemplates).filter(
          (s) => s.workspaceId === workspaceId,
        );
        const isPrimary = existing.length === 0 ? true : input.isPrimary ?? false;
        const template: MockScriptTemplate = {
          name: input.name,
          content: input.content,
          id: newId('scr'),
          workspaceId,
          isPrimary,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => {
            const scriptTemplates = { ...state.scriptTemplates };
            if (isPrimary) {
              for (const s of Object.values(scriptTemplates)) {
                if (s.workspaceId === workspaceId && s.isPrimary) {
                  scriptTemplates[s.id] = { ...s, isPrimary: false, updatedAt: nowIso() };
                }
              }
            }
            scriptTemplates[template.id] = template;
            return { scriptTemplates };
          },
          undefined,
          'mock/addScriptTemplate',
        );
        return template;
      },

      updateScriptTemplate: (scriptTemplateId, patch) => {
        const existing = get().scriptTemplates[scriptTemplateId];
        if (!existing) return null;
        const updated: MockScriptTemplate = { ...existing, ...patch, updatedAt: nowIso() };
        set(
          (state) => ({
            scriptTemplates: { ...state.scriptTemplates, [scriptTemplateId]: updated },
          }),
          undefined,
          'mock/updateScriptTemplate',
        );
        return updated;
      },

      setPrimaryScriptTemplate: (scriptTemplateId) =>
        set(
          (state) => {
            const target = state.scriptTemplates[scriptTemplateId];
            if (!target) return state;
            const scriptTemplates = { ...state.scriptTemplates };
            for (const s of Object.values(scriptTemplates)) {
              if (s.workspaceId !== target.workspaceId) continue;
              const shouldBePrimary = s.id === scriptTemplateId;
              if (s.isPrimary !== shouldBePrimary) {
                scriptTemplates[s.id] = {
                  ...s,
                  isPrimary: shouldBePrimary,
                  updatedAt: nowIso(),
                };
              }
            }
            return { scriptTemplates };
          },
          undefined,
          'mock/setPrimaryScriptTemplate',
        ),

      setPrecallIntelligence: (input) => {
        // One bundle per opportunity — keyed by opportunity id, replaced on regenerate.
        const existing = Object.values(get().precallIntelligence).find(
          (p) => p.opportunityId === input.opportunityId,
        );
        const precall: MockPrecallIntelligence = {
          ...input,
          id: existing?.id ?? newId('pci'),
          generatedAt: nowIso(),
        };
        set(
          (state) => ({
            precallIntelligence: { ...state.precallIntelligence, [precall.id]: precall },
          }),
          undefined,
          'mock/setPrecallIntelligence',
        );
        return precall;
      },

      addImportMapping: (workspaceId, input) => {
        const mapping: MockImportMapping = {
          ...input,
          id: newId('imp'),
          workspaceId,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set(
          (state) => ({
            importMappings: { ...state.importMappings, [mapping.id]: mapping },
          }),
          undefined,
          'mock/addImportMapping',
        );
        return mapping;
      },
    }),
    { name: 'pg-mock-store', enabled: import.meta.env.DEV },
  ),
);

// --- Selector hooks (subscribe to fine-grained slices) ---

export const useCurrentSession = () => useMockStore((s) => s.session);

export const useWorkspace = () =>
  useMockStore((s) => (s.session ? s.workspaces[s.session.workspaceId] ?? null : null));

// In-progress onboarding wizard state (M10). A single object reference, stable
// until `updateOnboardingDraft` replaces it — no `useShallow` needed.
export const useOnboardingDraft = () => useMockStore((s) => s.onboardingDraft);

// Array-returning selectors below all wrap in `useShallow` — zustand v5 treats
// a fresh array reference as a state change and will infinite-loop on consumers
// otherwise. Same pattern as use-workspace-stages.ts.

export const useProductsForCurrentWorkspace = () =>
  useMockStore(
    useShallow((s) => {
      if (!s.session) return [];
      return Object.values(s.products).filter((p) => p.workspaceId === s.session?.workspaceId);
    }),
  );

// The primary product is the default context for new opportunities.
export const usePrimaryProduct = () =>
  useMockStore((s) => {
    if (!s.session) return null;
    const products = Object.values(s.products).filter(
      (p) => p.workspaceId === s.session?.workspaceId,
    );
    return products.find((p) => p.isPrimary) ?? products[0] ?? null;
  });

// Back-compat alias for M3–M6 surfaces written against single-product workspaces.
export const useProductForCurrentWorkspace = usePrimaryProduct;

export const useBuyersForCurrentWorkspace = () =>
  useMockStore(
    useShallow((s) => {
      if (!s.session) return [];
      return Object.values(s.buyers).filter((b) => b.workspaceId === s.session?.workspaceId);
    }),
  );

export const useScriptTemplatesForCurrentWorkspace = () =>
  useMockStore(
    useShallow((s) => {
      if (!s.session) return [];
      return Object.values(s.scriptTemplates).filter(
        (t) => t.workspaceId === s.session?.workspaceId,
      );
    }),
  );

export const useOpportunities = () =>
  useMockStore(
    useShallow((s) => {
      if (!s.session) return [];
      const workspaceId = s.session.workspaceId;
      return Object.values(s.opportunities).filter((o) => o.workspaceId === workspaceId);
    }),
  );

export const useOpportunityById = (id: string | undefined) =>
  useMockStore((s) => (id ? s.opportunities[id] ?? null : null));

export const useBuyerById = (id: string | undefined) =>
  useMockStore((s) => (id ? s.buyers[id] ?? null : null));

export const useProductById = (id: string | undefined) =>
  useMockStore((s) => (id ? s.products[id] ?? null : null));

export const useActivitiesForOpportunity = (opportunityId: string | undefined) =>
  useMockStore(
    useShallow((s) => {
      if (!opportunityId) return [];
      return Object.values(s.activities)
        .filter((a) => a.opportunityId === opportunityId)
        .sort((a, b) => b.activityDate.localeCompare(a.activityDate));
    }),
  );

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
  useMockStore(
    useShallow((s) => {
      if (!opportunityId) return [];
      return Object.values(s.diagnoses)
        .filter((d) => d.opportunityId === opportunityId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
  );

export const useOutcomesForOpportunity = (opportunityId: string | undefined) =>
  useMockStore(
    useShallow((s) => {
      if (!opportunityId) return [];
      return Object.values(s.outcomes)
        .filter((o) => o.opportunityId === opportunityId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }),
  );

export const usePrecallIntelligenceForOpportunity = (opportunityId: string | undefined) =>
  useMockStore((s) => {
    if (!opportunityId) return null;
    return (
      Object.values(s.precallIntelligence).find((p) => p.opportunityId === opportunityId) ?? null
    );
  });

// --- Action accessors (stable refs; safe to use outside React) ---

export const mockActions = {
  hydrate: (input: HydrateInput) => useMockStore.getState().hydrate(input),
  reset: () => useMockStore.getState().reset(),
  setSession: (session: MockSession) => useMockStore.getState().setSession(session),
  clearSession: () => useMockStore.getState().clearSession(),
  completeOnboarding: () => useMockStore.getState().completeOnboarding(),
  activateSubscription: () => useMockStore.getState().activateSubscription(),
  updateOnboardingDraft: (patch: Parameters<MockActions['updateOnboardingDraft']>[0]) =>
    useMockStore.getState().updateOnboardingDraft(patch),
  resetOnboardingDraft: () => useMockStore.getState().resetOnboardingDraft(),
  addBuyer: (input: Parameters<MockActions['addBuyer']>[0]) =>
    useMockStore.getState().addBuyer(input),
  addOpportunity: (input: Parameters<MockActions['addOpportunity']>[0]) =>
    useMockStore.getState().addOpportunity(input),
  addActivity: (input: Parameters<MockActions['addActivity']>[0]) =>
    useMockStore.getState().addActivity(input),
  runDiagnosis: (input: Parameters<MockActions['runDiagnosis']>[0]) =>
    useMockStore.getState().runDiagnosis(input),
  recordOutcome: (input: Parameters<MockActions['recordOutcome']>[0]) =>
    useMockStore.getState().recordOutcome(input),
  setAtRisk: (opportunityId: string, atRisk: boolean) =>
    useMockStore.getState().setAtRisk(opportunityId, atRisk),
  moveOpportunityToStage: (opportunityId: string, newStage: string) =>
    useMockStore.getState().moveOpportunityToStage(opportunityId, newStage),
  assignBuyersToProduct: (buyerIds: string[], productId: string) =>
    useMockStore.getState().assignBuyersToProduct(buyerIds, productId),
  addWorkspace: (input: Parameters<MockActions['addWorkspace']>[0]) =>
    useMockStore.getState().addWorkspace(input),
  updateWorkspace: (
    workspaceId: string,
    patch: Parameters<MockActions['updateWorkspace']>[1],
  ) => useMockStore.getState().updateWorkspace(workspaceId, patch),
  addProduct: (
    workspaceId: string,
    input: Parameters<MockActions['addProduct']>[1],
  ) => useMockStore.getState().addProduct(workspaceId, input),
  updateProduct: (
    productId: string,
    patch: Parameters<MockActions['updateProduct']>[1],
  ) => useMockStore.getState().updateProduct(productId, patch),
  setPrimaryProduct: (productId: string) =>
    useMockStore.getState().setPrimaryProduct(productId),
  upsertProductForWorkspace: (
    workspaceId: string,
    input: Parameters<MockActions['upsertProductForWorkspace']>[1],
  ) => useMockStore.getState().upsertProductForWorkspace(workspaceId, input),
  addScriptTemplate: (
    workspaceId: string,
    input: Parameters<MockActions['addScriptTemplate']>[1],
  ) => useMockStore.getState().addScriptTemplate(workspaceId, input),
  updateScriptTemplate: (
    scriptTemplateId: string,
    patch: Parameters<MockActions['updateScriptTemplate']>[1],
  ) => useMockStore.getState().updateScriptTemplate(scriptTemplateId, patch),
  setPrimaryScriptTemplate: (scriptTemplateId: string) =>
    useMockStore.getState().setPrimaryScriptTemplate(scriptTemplateId),
  setPrecallIntelligence: (input: Parameters<MockActions['setPrecallIntelligence']>[0]) =>
    useMockStore.getState().setPrecallIntelligence(input),
  addImportMapping: (
    workspaceId: string,
    input: Parameters<MockActions['addImportMapping']>[1],
  ) => useMockStore.getState().addImportMapping(workspaceId, input),
};

// --- Read-only helpers ---

export interface BuyerMatchInput {
  firstName: string;
  company: string;
  email: string | null;
}

// Match priority: exact email match wins; otherwise case-insensitive
// (firstName + company) fallback. Returns null if no buyer in the workspace matches.
export function findMatchingBuyer(
  workspaceId: string,
  input: BuyerMatchInput,
): MockBuyer | null {
  const buyers = Object.values(useMockStore.getState().buyers).filter(
    (b) => b.workspaceId === workspaceId,
  );
  if (input.email) {
    const target = input.email.toLowerCase();
    const byEmail = buyers.find((b) => b.email && b.email.toLowerCase() === target);
    if (byEmail) return byEmail;
  }
  const firstName = input.firstName.toLowerCase();
  const company = input.company.toLowerCase();
  return (
    buyers.find(
      (b) =>
        b.firstName.toLowerCase() === firstName && b.company.toLowerCase() === company,
    ) ?? null
  );
}
