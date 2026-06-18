import { useEffect, useState } from 'react';
import type { MatchedTechnique, PsychProfile } from '@pg/shared';
import { copilotData, type BuyerIdentity, type StartCallContext } from './copilot-data';

// Pre-fetches the pre-grounding payload for a bound call (PG-292). When the rep
// launches from a deal (or picks one), we resolve the opportunity context — and,
// if no precall/script exists yet, generate one — eagerly on bind, so the payload
// is ready the instant they hit Start (the §7 latency lever: no fetch/generation
// stall between click and audio). A cold start (`opportunityId === null`) leaves
// `context` null and the call begins with live discovery, unchanged.
//
// Two parallel fetches (PG-313):
//   - a fast `getPrecallPreview` (one query) → `preview`, so the Buyer/Technique
//     panels show the already-matched read immediately instead of the cold
//     "listening" placeholder while the rest loads;
//   - the full `getStartCallContext` → `context`, the payload handed to `start`.
// A watchdog stops gating Start after a stall so the rep is never stuck.

/** What the prep is doing — drives the status text the overlay shows. */
export type BoundCallStatus = 'idle' | 'loading' | 'generating' | 'ready' | 'error';

export interface BoundCallContext {
  /** The ready payload to hand to `start(context)`; null while loading, on a cold start, or on failure. */
  context: StartCallContext | null;
  /** The already-matched buyer read + technique, available a beat before the full context (for panel preview). */
  preview: { buyerProfile: PsychProfile; technique: MatchedTechnique } | null;
  /** The bound buyer's name/company/title for the call-screen confirm header (PG-317); null on a cold start or before it loads. */
  identity: BuyerIdentity | null;
  /** True while the full context (incl. any on-demand precall generation) is being prepared. */
  loading: boolean;
  /** Coarse phase of the prep, for a human-readable status line. */
  status: BoundCallStatus;
  /** Set when prep failed or stalled; the call can still start cold, but the UI should say so. */
  error: string | null;
}

// How long to gate Start before giving up and letting the rep start anyway. The
// happy path resolves in well under a second; a deal with no precall yet runs an
// LLM generation (~10–20s), so the watchdog sits comfortably past that.
const PREP_WATCHDOG_MS = 25_000;

const EMPTY: BoundCallContext = {
  context: null,
  preview: null,
  identity: null,
  loading: false,
  status: 'idle',
  error: null,
};

export function useBoundCallContext(opportunityId: string | null): BoundCallContext {
  const [state, setState] = useState<BoundCallContext>(EMPTY);

  useEffect(() => {
    if (!opportunityId) {
      setState(EMPTY);
      return;
    }

    // Correctness is owned by the per-run `cancelled` flag (set in cleanup), NOT a
    // "have I fetched this id?" ref. A sticky ref breaks React StrictMode's dev
    // double-mount: the first run gets cancelled in cleanup, and a ref guard then
    // makes the second run early-return instead of re-fetching, so the resolved
    // promises are all discarded and the panel hangs on "Loading" forever (PG-313).
    // The effect only re-runs when `opportunityId` changes, so there are no spurious
    // refetches to guard against here anyway.
    let cancelled = false;
    setState({
      context: null,
      preview: null,
      identity: null,
      loading: true,
      status: 'loading',
      error: null,
    });

    // Buyer identity for the confirm header (PG-317) — independent of precall, so it
    // resolves even for a deal with no precall yet. Best-effort: a failure just omits
    // the header rather than blocking the call.
    void copilotData
      .getBuyerIdentity(opportunityId)
      .then((identity) => {
        if (!cancelled) setState((s) => ({ ...s, identity }));
      })
      .catch(() => {
        // Identity is decorative confirmation; the call proceeds without it.
      });

    // Fast preview — fill the panels ASAP with what's already matched. If there's
    // no precall yet, the full fetch below will generate it: flag that as 'generating'
    // so the status line can explain the longer wait.
    void copilotData
      .getPrecallPreview(opportunityId)
      .then((preview) => {
        if (cancelled) return;
        setState((s) =>
          preview
            ? { ...s, preview }
            : s.status === 'loading'
              ? { ...s, status: 'generating' }
              : s,
        );
      })
      .catch(() => {
        // Preview is best-effort; the full fetch result (or its error) is authoritative.
      });

    // Full pre-grounding payload — what `start(context)` needs.
    void copilotData
      .getStartCallContext(opportunityId)
      .then((context) => {
        if (!cancelled) setState((s) => ({ ...s, context, loading: false, status: 'ready' }));
      })
      .catch((err) => {
        // A failed prep degrades to a cold start rather than blocking the call —
        // but record the error so the UI can say the buyer read/technique are
        // missing, instead of silently starting cold.
        if (!cancelled)
          setState((s) => ({
            ...s,
            context: null,
            loading: false,
            status: 'error',
            error:
              err instanceof Error ? err.message : "Couldn't load this deal's pre-call intelligence",
          }));
      });

    // Watchdog: never gate Start forever. If prep is still running, stop blocking and
    // tell the rep they can start now (the call will use whatever loaded).
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      setState((s) =>
        s.loading
          ? {
              ...s,
              loading: false,
              error:
                s.error ??
                'Pre-call prep is taking longer than expected — you can start now (the call will use what loaded).',
            }
          : s,
      );
    }, PREP_WATCHDOG_MS);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, [opportunityId]);

  return state;
}
