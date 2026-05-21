import type { ReadinessState } from '@pg/shared';
import { type ExportTier, packExportTier } from '../lib/exports';
import { computeProvisionalReadiness } from './fake-diagnosis';
import { useMockStore } from './store';
import type { MockActivity, MockBuyer, MockDiagnosis, MockOpportunity, MockProduct } from './types';

// Denormalized read-model for the CRM Update Pack (M18). One opportunity joined
// with its buyer, product, latest diagnosis, and the bookkeeping the end-of-day
// export needs: what changed since the rep last exported this deal, and which
// export tier it falls into. What a real `export.pack` tRPC endpoint would
// return; the `/export` surface renders this shape directly.
export interface ExportPackRow {
  opportunity: MockOpportunity;
  buyer: MockBuyer | null;
  product: MockProduct | null;
  latestDiagnosis: MockDiagnosis | null;
  // The readiness the row renders. A diagnosed deal reads off its latest
  // diagnosis; an activity-less deal gets a provisional, CRM-stage-derived read
  // (parity with the M17 detail header) so the row is never blank.
  readinessState: ReadinessState;
  readinessScore: number;
  isProvisional: boolean;
  // Score movement since the last export. null when the deal has never been
  // exported — there is no baseline, so its whole readiness is new to the CRM.
  scoreSinceExport: number | null;
  lastExportedAt: string | null;
  // Activities logged since the last export (every activity when never
  // exported). > 0 ⟺ the deal is in the default pre-checked working set.
  activitySinceExport: number;
  totalActivityCount: number;
  latestActivityAt: string;
  hasNewActivity: boolean;
  // `crm_import` ⟺ the deal carries a CRM Record ID and the workspace has a CRM
  // selected; otherwise `copy_only` (PG-231/232).
  tier: ExportTier;
}

export function buildExportPackRows(workspaceId: string): ExportPackRow[] {
  const state = useMockStore.getState();
  const crmType = state.workspaces[workspaceId]?.crmType ?? null;

  const activitiesByOpp = new Map<string, MockActivity[]>();
  for (const a of Object.values(state.activities)) {
    const list = activitiesByOpp.get(a.opportunityId);
    if (list) list.push(a);
    else activitiesByOpp.set(a.opportunityId, [a]);
  }

  const diagnosesByOpp = new Map<string, MockDiagnosis[]>();
  for (const d of Object.values(state.diagnoses)) {
    const list = diagnosesByOpp.get(d.opportunityId);
    if (list) list.push(d);
    else diagnosesByOpp.set(d.opportunityId, [d]);
  }

  const rows: ExportPackRow[] = [];
  for (const opp of Object.values(state.opportunities)) {
    if (opp.workspaceId !== workspaceId) continue;

    const activities = activitiesByOpp.get(opp.id) ?? [];
    // The Update Pack reports deals with buyer evidence to write back — a deal
    // with no activity has nothing to report. (Its provisional note is still
    // reachable on the per-opportunity Export tab.)
    if (activities.length === 0) continue;

    // Diagnoses oldest-first so the last entry is the chronologically latest.
    const diagnoses = [...(diagnosesByOpp.get(opp.id) ?? [])].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const latestDiagnosis = diagnoses[diagnoses.length - 1] ?? null;
    const lastExportedAt = state.exportTimestamps[opp.id] ?? null;

    // "Since last export" counts activities by `createdAt` — when the rep
    // logged the row — not `activityDate`, which is the meeting date and can
    // predate the logging.
    const activitySinceExport = lastExportedAt
      ? activities.filter((a) => a.createdAt > lastExportedAt).length
      : activities.length;

    // Movement: the latest score against the score at the last export. The
    // baseline is the most recent diagnosis at or before the export timestamp.
    let scoreSinceExport: number | null = null;
    if (lastExportedAt && latestDiagnosis) {
      const priorToExport = diagnoses.filter((d) => d.createdAt <= lastExportedAt);
      const baseline = priorToExport[priorToExport.length - 1];
      if (baseline) {
        scoreSinceExport = latestDiagnosis.readinessScore - baseline.readinessScore;
      }
    }

    const readiness = latestDiagnosis
      ? {
          state: latestDiagnosis.readinessState,
          score: latestDiagnosis.readinessScore,
          isProvisional: false,
        }
      : { ...computeProvisionalReadiness(opp.currentCrmStage), isProvisional: true };

    const latestActivityAt = activities.reduce(
      (latest, a) => (a.createdAt > latest ? a.createdAt : latest),
      activities[0]?.createdAt ?? opp.createdAt,
    );

    rows.push({
      opportunity: opp,
      buyer: state.buyers[opp.buyerId] ?? null,
      product: state.products[opp.productId] ?? null,
      latestDiagnosis,
      readinessState: readiness.state,
      readinessScore: readiness.score,
      isProvisional: readiness.isProvisional,
      scoreSinceExport,
      lastExportedAt,
      activitySinceExport,
      totalActivityCount: activities.length,
      latestActivityAt,
      hasNewActivity: activitySinceExport > 0,
      tier: packExportTier(opp, crmType),
    });
  }

  // Most-recently-active deals first — the freshest news sits at the top.
  rows.sort((a, b) => b.latestActivityAt.localeCompare(a.latestActivityAt));
  return rows;
}
