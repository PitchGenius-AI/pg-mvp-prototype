import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@pg/api/router';
import type { MatchedTechnique, PsychProfile, SellerProduct } from '@pg/shared';
import { trpc } from './client';

// The desktop's data seam over the real backend (M33/PG-290). Every shape is
// derived from the router via `inferRouterOutputs`, so a server-side change
// surfaces here at typecheck rather than at runtime. The picker (PG-291),
// product-context resolution (PG-293), and call save-back (PG-294) all consume
// this interface; keeping it an interface (not bare calls) leaves a mock/offline
// implementation swappable behind it.

type Outputs = inferRouterOutputs<AppRouter>;

export type CopilotWorkbenchRow = Outputs['workbench']['rows'][number];
export type CopilotWorkspace = Outputs['workspace']['getCurrent'];
export type CopilotOpportunity = Outputs['opportunity']['get'];
export type CopilotBuyer = Outputs['buyer']['get'];
export type CopilotProduct = Outputs['product']['get'];
export type CopilotDiagnosis = Outputs['diagnosis']['latestForOpportunity'];
export type CopilotPrecall = Outputs['precall']['forOpportunity'];

// Recency scope for the opportunity picker; mirrors the web workbench periods.
export type WorkbenchPeriod = 'today' | 'week' | 'month' | 'all';

// Everything the planner/binding (PG-292) needs to pre-ground a bound call: the
// opportunity (denormalized readiness + known pain/objection), its buyer and
// product (resolved by id), the latest diagnosis, and any precall intelligence
// (DISC/OCEAN + matched technique + generated script).
export interface CopilotOpportunityContext {
  opportunity: CopilotOpportunity;
  buyer: CopilotBuyer;
  product: CopilotProduct;
  diagnosis: CopilotDiagnosis;
  precall: CopilotPrecall;
}

// The pre-grounding payload threaded into the Rust `start_call` command when a
// call is bound to an opportunity (PG-292). Every field is the shape the planner
// mirror in `src-tauri/src/planner/` deserializes; all are camelCase on the wire.
// A cold start passes no context at all (the planner runs live discovery). When
// bound, the planner SKIPS discovery, pre-fills the Buyer/Technique panels from
// `buyerProfile`/`technique`, seeds `product` (short-circuiting the live product
// match for this call), and drives the live cue chain from `scriptSections`.
export interface StartCallContext {
  opportunityId: string;
  /** The bound opportunity's product, mapped to the planner's SellerProduct shape; null if unresolved. */
  product: SellerProduct | null;
  /** The prepped DISC/OCEAN buyer read (from precall), seeded so discovery can be skipped; null if no precall. */
  buyerProfile: PsychProfile | null;
  /** The matched sales technique (from precall), seeded locked; null if no precall. */
  technique: MatchedTechnique | null;
  /** The generated pre-call script sections that become the live cue chain; empty if no precall. */
  scriptSections: Array<{ heading: string; body: string }>;
  /** Free-text grounding (known pain/objection + diagnosis blocker) for cue generation; null if none. */
  groundingNotes: string | null;
}

export interface CopilotDataSource {
  /** The rep's opportunities for the picker (joined with buyer/product/readiness), recency-filtered client-side. */
  listOpportunities(period?: WorkbenchPeriod): Promise<CopilotWorkbenchRow[]>;
  /** The account's product context — all products + primary; null until onboarding is done. */
  resolveProductContext(): Promise<CopilotWorkspace>;
  /** Buyer + product (resolved by id) + latest diagnosis + precall for a bound opportunity. */
  getOpportunityContext(opportunityId: string): Promise<CopilotOpportunityContext>;
  /**
   * The full pre-grounding payload for a bound call: reads the opportunity context
   * and, when no precall/script exists yet, generates one on demand (`precall.run`)
   * so the call can still skip discovery and drive from a prepared script.
   */
  getStartCallContext(opportunityId: string): Promise<StartCallContext>;
  /**
   * The already-matched buyer read + technique for the picker→overlay preview — a
   * single `precall.forOpportunity` call (no buyer/product/diagnosis round-trips),
   * so the Buyer/Technique panels can fill the instant the deal is picked. Returns
   * null when the deal has no precall yet (the full `getStartCallContext` will then
   * generate it).
   */
  getPrecallPreview(
    opportunityId: string,
  ): Promise<{ buyerProfile: PsychProfile; technique: MatchedTechnique } | null>;
}

// Lower bound (epoch ms) for a recency period; <= 0 means "no bound" (all).
function periodCutoff(period: WorkbenchPeriod): number {
  const DAY = 24 * 60 * 60 * 1000;
  if (period === 'today') {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  if (period === 'week') return Date.now() - 7 * DAY;
  if (period === 'month') return Date.now() - 30 * DAY;
  return 0; // 'all'
}

/** Whether an ISO `lastActiveAt` falls within the given recency period. */
export function inPeriod(lastActiveAt: string, period: WorkbenchPeriod): boolean {
  const cutoff = periodCutoff(period);
  return cutoff <= 0 || new Date(lastActiveAt).getTime() >= cutoff;
}

// The real (tRPC) implementation — uses the authenticated client from PG-289.
export const copilotData: CopilotDataSource = {
  async listOpportunities(period = 'all') {
    const rows = await trpc.workbench.rows.query();
    return period === 'all' ? rows : rows.filter((row) => inPeriod(row.lastActiveAt, period));
  },

  resolveProductContext() {
    return trpc.workspace.getCurrent.query();
  },

  async getOpportunityContext(opportunityId) {
    const [opportunity, diagnosis, precall] = await Promise.all([
      trpc.opportunity.get.query({ id: opportunityId }),
      trpc.diagnosis.latestForOpportunity.query({ opportunityId }),
      trpc.precall.forOpportunity.query({ opportunityId }),
    ]);
    // Resolve buyer + product by id once we know them (the opportunity carries
    // only the ids). Parallel, after the opportunity since they depend on it.
    const [buyer, product] = await Promise.all([
      trpc.buyer.get.query({ id: opportunity.buyerId }),
      trpc.product.get.query({ id: opportunity.productId }),
    ]);
    return { opportunity, buyer, product, diagnosis, precall };
  },

  async getStartCallContext(opportunityId) {
    const ctx = await this.getOpportunityContext(opportunityId);
    // Use the prepped precall/script if present; otherwise generate one on demand
    // so the bound call can still skip discovery and drive from a real script
    // (the script "should already exist" per the diagnosis flow — until that lands
    // we generate it here). A generation failure degrades to no precall, and the
    // planner falls back toward live discovery rather than failing the call.
    let precall = ctx.precall;
    if (!precall) {
      try {
        precall = await trpc.precall.run.mutate({ opportunityId });
      } catch {
        precall = null;
      }
    }
    return toStartCallContext({ ...ctx, precall });
  },

  async getPrecallPreview(opportunityId) {
    const precall = await trpc.precall.forOpportunity.query({ opportunityId });
    if (!precall) return null;
    return { buyerProfile: precall.psychProfile, technique: precall.matchedTechnique };
  },
};

// Pure mapper: opportunity context → the Rust `start_call` payload. Maps the web
// `Product` (targetBuyer/problemSolved) onto the planner's SellerProduct
// (icp/problem), carries the precall DISC/OCEAN + matched technique + script
// sections verbatim, and folds known pain/objection + the latest diagnosis blocker
// into a single grounding note.
export function toStartCallContext(ctx: CopilotOpportunityContext): StartCallContext {
  const { opportunity, product, diagnosis, precall } = ctx;
  return {
    opportunityId: opportunity.id,
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      icp: product.targetBuyer,
      problem: product.problemSolved,
      sourceUrl: null,
      isPrimary: product.isPrimary,
    },
    buyerProfile: precall?.psychProfile ?? null,
    technique: precall?.matchedTechnique ?? null,
    scriptSections: precall?.generatedScript.sections ?? [],
    groundingNotes: buildGroundingNotes(opportunity, diagnosis),
  };
}

function buildGroundingNotes(
  opportunity: CopilotOpportunity,
  diagnosis: CopilotDiagnosis,
): string | null {
  const parts: string[] = [];
  if (opportunity.knownPain) parts.push(`Known pain: ${opportunity.knownPain}`);
  if (opportunity.knownObjection) parts.push(`Known objection: ${opportunity.knownObjection}`);
  if (diagnosis) {
    parts.push(
      `Readiness: ${diagnosis.readinessState} (${diagnosis.readinessScore}/100).` +
        (diagnosis.primaryBlocker ? ` Primary blocker: ${diagnosis.primaryBlocker}.` : ''),
    );
  }
  return parts.length > 0 ? parts.join('\n') : null;
}
