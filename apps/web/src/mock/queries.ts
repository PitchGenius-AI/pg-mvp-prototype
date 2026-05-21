// Centralized query-key factory. Mirrors what tRPC + TanStack Query would emit
// for the eventual real routers (e.g. `['opportunity', 'list', { workspaceId }]`),
// so when we swap to tRPC the cache keys + invalidation patterns stay aligned.

export const queryKeys = {
  session: ['session'] as const,

  workspace: {
    current: ['workspace', 'current'] as const,
  },

  product: {
    all: ['product'] as const,
    forCurrentWorkspace: ['product', 'forCurrentWorkspace'] as const,
    primary: ['product', 'primary'] as const,
  },

  buyer: {
    all: ['buyer'] as const,
    list: () => ['buyer', 'list'] as const,
    byId: (id: string) => ['buyer', 'byId', id] as const,
    // Read-model for the M13 Buyers directory: buyers joined with opportunity
    // count + assigned/unassigned status.
    directory: () => ['buyer', 'directory'] as const,
  },

  opportunity: {
    all: ['opportunity'] as const,
    list: () => ['opportunity', 'list'] as const,
    byId: (id: string) => ['opportunity', 'byId', id] as const,
  },

  // Denormalized read-model for the Opportunity Workbench (M12): opportunities
  // joined with buyer, product, latest activity + latest diagnosis in one fetch.
  workbench: {
    all: ['workbench'] as const,
    rows: () => ['workbench', 'rows'] as const,
  },

  activity: {
    all: ['activity'] as const,
    forOpportunity: (opportunityId: string) =>
      ['activity', 'forOpportunity', opportunityId] as const,
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

  scriptTemplate: {
    all: ['scriptTemplate'] as const,
    list: () => ['scriptTemplate', 'list'] as const,
  },

  precall: {
    forOpportunity: (opportunityId: string) =>
      ['precall', 'forOpportunity', opportunityId] as const,
  },

  importMapping: {
    all: ['importMapping'] as const,
    list: () => ['importMapping', 'list'] as const,
  },
};
