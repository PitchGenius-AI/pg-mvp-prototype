import { SIMPLE_B2B_SALES_STAGES } from '@pg/shared';
import { useShallow } from 'zustand/react/shallow';
import { useMockStore } from './store';

// Resolves the active CRM stage list for the current workspace.
// Returns the simple-b2b-sales template stages OR the workspace's custom stages
// (sorted by `order`). Empty array if no session.
//
// Wrapped in useShallow because the selector produces a fresh array on every
// call; without shallow comparison Zustand would treat every render as a change
// and infinite-loop on consumers (e.g. the structured form in the add modal).
export function useWorkspaceStages(): string[] {
  return useMockStore(
    useShallow((s) => {
      if (!s.session) return [];
      const workspace = s.workspaces[s.session.workspaceId];
      if (!workspace) return [];
      if (workspace.crmStageTemplate === 'custom') {
        return (workspace.customCrmStages ?? [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((stage) => stage.name);
      }
      return [...SIMPLE_B2B_SALES_STAGES];
    }),
  );
}
