import { SIMPLE_B2B_SALES_STAGES } from '@pg/shared';
import { useMemo } from 'react';
import { useCurrentWorkspace } from './hooks';

// Resolves the active CRM stage list for the current workspace (from the real
// backend): the workspace's custom stages (sorted by `order`) when its template
// is `custom`, otherwise the simple-b2b-sales template. Empty until the workspace
// query resolves. Memoized so consumers get a stable array reference.
export function useWorkspaceStages(): string[] {
  const { data: workspace } = useCurrentWorkspace();
  return useMemo(() => {
    if (!workspace) return [];
    if (workspace.crmStageTemplate === 'custom') {
      return (workspace.customCrmStages ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((stage) => stage.name);
    }
    return [...SIMPLE_B2B_SALES_STAGES];
  }, [workspace]);
}
