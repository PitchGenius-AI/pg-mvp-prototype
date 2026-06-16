import { useEffect, useRef, useState } from 'react';
import { copilotData, type StartCallContext } from './copilot-data';

// Pre-fetches the pre-grounding payload for a bound call (PG-292). When the rep
// launches from a deal (or picks one), we resolve the opportunity context — and,
// if no precall/script exists yet, generate one — eagerly on bind, so the payload
// is ready the instant they hit Start (the §7 latency lever: no fetch/generation
// stall between click and audio). A cold start (`opportunityId === null`) leaves
// `context` null and the call begins with live discovery, unchanged.
//
// Generation runs at most once per opportunity id (guarded), so re-renders don't
// re-trigger the `precall.run` mutation.
export interface BoundCallContext {
  /** The ready payload to hand to `start(context)`; null while loading, on a cold start, or on failure. */
  context: StartCallContext | null;
  /** True while the context (incl. any on-demand precall generation) is being prepared. */
  loading: boolean;
}

export function useBoundCallContext(opportunityId: string | null): BoundCallContext {
  const [context, setContext] = useState<StartCallContext | null>(null);
  const [loading, setLoading] = useState(false);
  // The opportunity id we last kicked a fetch for — guards against duplicate
  // generation across re-renders while keeping a fresh fetch when the binding changes.
  const fetchedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!opportunityId) {
      setContext(null);
      setLoading(false);
      fetchedFor.current = null;
      return;
    }
    if (fetchedFor.current === opportunityId) return;
    fetchedFor.current = opportunityId;

    let cancelled = false;
    setLoading(true);
    setContext(null);
    void copilotData
      .getStartCallContext(opportunityId)
      .then((ctx) => {
        if (!cancelled) setContext(ctx);
      })
      .catch(() => {
        // A failed prep degrades to a cold start rather than blocking the call.
        if (!cancelled) setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [opportunityId]);

  return { context, loading };
}
