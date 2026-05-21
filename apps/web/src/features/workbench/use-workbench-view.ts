import { useCallback, useState } from 'react';

// Board is the default Workbench view (PG-200). The choice persists per user —
// localStorage rather than the URL, since it's a durable preference, not a
// shareable/bookmarkable view of the data (filters + sort carry that).
export type WorkbenchView = 'board' | 'list';

const STORAGE_KEY = 'pg.workbench.view';
const DEFAULT_VIEW: WorkbenchView = 'board';

function readStoredView(): WorkbenchView {
  if (typeof window === 'undefined') return DEFAULT_VIEW;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'list' ? 'list' : 'board';
  } catch {
    return DEFAULT_VIEW;
  }
}

export function useWorkbenchView(): [WorkbenchView, (view: WorkbenchView) => void] {
  const [view, setViewState] = useState<WorkbenchView>(readStoredView);

  const setView = useCallback((next: WorkbenchView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private-mode / disabled storage — the in-memory state still works for
      // this session; persistence is best-effort.
    }
  }, []);

  return [view, setView];
}
