import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@pg/api/router';
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
export type CopilotDiagnosis = Outputs['diagnosis']['latestForOpportunity'];
export type CopilotPrecall = Outputs['precall']['forOpportunity'];

// Recency scope for the opportunity picker; mirrors the web workbench periods.
export type WorkbenchPeriod = 'today' | 'week' | 'month' | 'all';

// Everything the planner/binding (PG-292) needs to pre-ground a bound call: the
// opportunity (carries buyer/product ids + denormalized readiness), its latest
// diagnosis, and any precall intelligence (DISC/OCEAN + technique + script).
export interface CopilotOpportunityContext {
  opportunity: CopilotOpportunity;
  diagnosis: CopilotDiagnosis;
  precall: CopilotPrecall;
}

export interface CopilotDataSource {
  /** The rep's opportunities for the picker (joined with buyer/product/readiness), recency-filtered client-side. */
  listOpportunities(period?: WorkbenchPeriod): Promise<CopilotWorkbenchRow[]>;
  /** The account's product context — all products + primary; null until onboarding is done. */
  resolveProductContext(): Promise<CopilotWorkspace>;
  /** Buyer/product (via the opportunity) + latest diagnosis + precall for a bound opportunity. */
  getOpportunityContext(opportunityId: string): Promise<CopilotOpportunityContext>;
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
    return { opportunity, diagnosis, precall };
  },
};
