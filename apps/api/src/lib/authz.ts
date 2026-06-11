import { and, eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import type { Database } from '@pg/db';
import { activities, opportunities, workspaces } from '@pg/db/schema';

// Workspace authorization. A user may only see/mutate their own workspace's data
// (MVP is single-rep — one workspace per user). Every protected procedure routes
// its ownership check through one of these helpers so the rule lives in one place.
//
// The `assert*Access` helpers double as loaders: they fetch the entity, NOT_FOUND
// if it's missing, FORBIDDEN if the caller doesn't own its workspace, and return
// the row so callers don't re-query.

// The slice of tRPC context the authz helpers need. `protectedProcedure`
// guarantees `user` is non-null, so callers always satisfy this.
export interface AuthzCtx {
  db: Database;
  user: { id: string };
}

// Assert the user owns `workspaceId`. Returns the workspace row.
export async function assertWorkspaceAccess(ctx: AuthzCtx, workspaceId: string) {
  const ws = await ctx.db.query.workspaces.findFirst({
    where: and(eq(workspaces.id, workspaceId), eq(workspaces.createdByUserId, ctx.user.id)),
  });
  if (!ws) throw new TRPCError({ code: 'FORBIDDEN' });
  return ws;
}

// Resolve the caller's single workspace (MVP is one-per-user). Lets input-less
// list endpoints derive scope from the session instead of trusting a client id.
// Throws PRECONDITION_FAILED if the user hasn't completed onboarding yet.
export async function resolveWorkspace(ctx: AuthzCtx) {
  const ws = await ctx.db.query.workspaces.findFirst({
    where: eq(workspaces.createdByUserId, ctx.user.id),
  });
  if (!ws) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'No workspace yet' });
  return ws;
}

// Load an opportunity and assert the user owns its workspace. Returns the opp.
export async function assertOpportunityAccess(ctx: AuthzCtx, opportunityId: string) {
  const opp = await ctx.db.query.opportunities.findFirst({
    where: eq(opportunities.id, opportunityId),
  });
  if (!opp) throw new TRPCError({ code: 'NOT_FOUND' });
  await assertWorkspaceAccess(ctx, opp.workspaceId);
  return opp;
}

// Load an activity + its opportunity and assert workspace ownership. Returns both.
export async function assertActivityAccess(ctx: AuthzCtx, activityId: string) {
  const activity = await ctx.db.query.activities.findFirst({
    where: eq(activities.id, activityId),
  });
  if (!activity) throw new TRPCError({ code: 'NOT_FOUND' });
  const opportunity = await assertOpportunityAccess(ctx, activity.opportunityId);
  return { activity, opportunity };
}
