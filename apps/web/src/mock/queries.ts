// Centralized query-key factory. Mirrors what tRPC + TanStack Query would emit
// for the eventual real routers (e.g. `['opportunity', 'list', { workspaceId }]`),
// so when we swap to tRPC the cache keys + invalidation patterns stay aligned.

export const queryKeys = {
  session: ['session'] as const,

  workspace: {
    current: ['workspace', 'current'] as const,
  },

  product: {
    forCurrentWorkspace: ['product', 'forCurrentWorkspace'] as const,
  },

  opportunity: {
    all: ['opportunity'] as const,
    list: () => ['opportunity', 'list'] as const,
    byId: (id: string) => ['opportunity', 'byId', id] as const,
  },

  interaction: {
    forOpportunity: (opportunityId: string) =>
      ['interaction', 'forOpportunity', opportunityId] as const,
  },

  diagnosis: {
    byId: (id: string) => ['diagnosis', 'byId', id] as const,
    latestForOpportunity: (opportunityId: string) =>
      ['diagnosis', 'latestForOpportunity', opportunityId] as const,
    listForOpportunity: (opportunityId: string) =>
      ['diagnosis', 'listForOpportunity', opportunityId] as const,
  },

  outcome: {
    forOpportunity: (opportunityId: string) =>
      ['outcome', 'forOpportunity', opportunityId] as const,
  },
};
