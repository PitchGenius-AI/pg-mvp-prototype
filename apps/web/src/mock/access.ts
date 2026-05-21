import type { MockWorkspace } from './types';

// Hard-paywall predicate (M11, PG-197). A workspace can reach in-shell routes
// only once its subscription has "completed" payment. The mock checkout sets
// `active`; `trialing` is accepted too so a future trial path needs no guard
// change. Everything else (`none`, `past_due`, `canceled`) is gated to /checkout.
//
// Route guards and the M19 Live Co-pilot gating both read this single predicate
// so the access rule never drifts across surfaces.
export function hasActiveSubscription(workspace: MockWorkspace | null | undefined): boolean {
  return workspace?.subscriptionStatus === 'active' || workspace?.subscriptionStatus === 'trialing';
}
