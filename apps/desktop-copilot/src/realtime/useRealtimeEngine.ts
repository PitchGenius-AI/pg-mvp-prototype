import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { REALTIME_EVENT_CHANNEL, type RealtimeEvent } from '@pg/shared';
import type { StartCallContext } from '../api/copilot-data';
import type { PlayerState } from '../mock/useFixturePlayer';
import {
  buildCallSummary,
  trackDiscovery,
  type CallSummary,
  type CallView,
} from '../session';

// The live counterpart to useFixturePlayer (mock/useFixturePlayer.ts): instead
// of replaying a scripted fixture, it subscribes to the Rust engine's events on
// REALTIME_EVENT_CHANNEL and drives Start/End via the start_call / stop_call
// commands. It reduces the same wire events into the same PlayerState, so the
// overlay renders identically whichever producer is upstream (UX_SPEC §7).
//
// On top of the wire state it tracks the frontend-only call session (§5.7): the
// `view` (precall → live → summary), a minimal call clock (§5.1 timer), and the
// end-of-call summary snapshot built on End. None of this touches the contract —
// it's all derived from the same events the overlay already consumes.

export interface RealtimeEngine extends PlayerState {
  /** Top-level overlay view (§5.7): precall idle bar → live loop → summary card. */
  view: CallView;
  /** Call clock in ms (§5.1): ticks while live, frozen once the summary shows. */
  elapsedMs: number;
  /** The §5.7 end-of-call summary, snapshotted on End; null until then. */
  summary: CallSummary | null;
  /** Derived from engine state: a call is live once the engine leaves `idle`. */
  live: boolean;
  /** Invoke the Rust start_call command (begins capture → STT). When `context` is
   *  supplied (a bound call, PG-292), the planner pre-grounds from it and skips
   *  discovery; omitted/undefined is a cold start (live discovery, unchanged). */
  start: (context?: StartCallContext | null) => void;
  /** Invoke stop_call (releases the mic, ends the STT task) → show the summary. */
  stop: () => void;
  /** Invoke skip_cue (§5.2/§5.4): advance the planner to the next PROMPT without a
   *  buyer score — the manual stall-breaker for when STT mishears. */
  skip: () => void;
  /** A command-invocation failure (e.g. missing key, mic unavailable). The
   *  in-band `no_audio` engine state is surfaced separately by the status line. */
  error: string | null;
}

const EMPTY: PlayerState = {
  transcript: [],
  cue: null,
  engine: null,
  buyerProfile: null,
  technique: null,
  signal: null,
};

function applyEvent(s: PlayerState, e: RealtimeEvent): PlayerState {
  switch (e.type) {
    case 'transcript':
      return { ...s, transcript: [...s.transcript, e] };
    case 'cue':
      // A fresh PROMPT (including the re-planned head) clears any signal beat.
      return { ...s, cue: e, signal: e.state === 'prompt' ? null : s.signal };
    case 'engine_state':
      return { ...s, engine: e };
    case 'profile_update':
      return e.subject === 'buyer'
        ? { ...s, buyerProfile: { disc: e.disc, ocean: e.ocean, summary: e.summary } }
        : s;
    case 'technique_update':
      return { ...s, technique: e };
    case 'material_signal':
      return { ...s, signal: e };
    default:
      return s;
  }
}

export function useRealtimeEngine(): RealtimeEngine {
  const [state, setState] = useState<PlayerState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CallView>('precall');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState<CallSummary | null>(null);

  // Mirror the latest reduced state + the call's start time + discovery progress so
  // stop() can snapshot the summary synchronously without stale-closure reads.
  const stateRef = useRef(state);
  stateRef.current = state;
  const startedAtRef = useRef(0);
  const discoveryRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void listen<RealtimeEvent>(REALTIME_EVENT_CHANNEL, (e) => {
      const ev = e.payload;
      // Accumulate how far discovery got (for the summary's "n/total cues").
      if (ev.type === 'engine_state') {
        discoveryRef.current = trackDiscovery(discoveryRef.current, ev);
      }
      setState((s) => applyEvent(s, ev));
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // The call clock: tick while live, leave frozen otherwise (§5.1, §5.7 duration).
  useEffect(() => {
    if (view !== 'live') return;
    const tick = () => setElapsedMs(Date.now() - startedAtRef.current);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [view]);

  const start = useCallback((context?: StartCallContext | null) => {
    setState(EMPTY); // clear the prior call's record before a fresh one
    setSummary(null);
    setError(null);
    discoveryRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setView('live');
    // Pass `context` only when bound — a cold start invokes with no args so the
    // Rust command's `Option<StartCallContext>` resolves to None (unchanged path).
    void invoke('start_call', context ? { context } : undefined).catch((err) =>
      setError(String(err)),
    );
  }, []);

  const stop = useCallback(() => {
    // Snapshot the summary from the final state before the engine's idle echo lands.
    const durationMs = Date.now() - startedAtRef.current;
    const s = stateRef.current;
    setSummary(
      buildCallSummary({
        buyer: s.buyerProfile,
        technique: s.technique,
        durationMs,
        discoveryCompleted: discoveryRef.current,
      }),
    );
    setElapsedMs(durationMs);
    setView('summary');
    void invoke('stop_call').catch((err) => setError(String(err)));
  }, []);

  // Manual skip (§5.2/§5.4): an input into the Rust planner run loop (no wire
  // event, no local state change) — the loop surfaces the next cue's PROMPT, which
  // flows back as normal events. No-op server-side if no call is live.
  const skip = useCallback(() => {
    void invoke('skip_cue').catch((err) => setError(String(err)));
  }, []);

  const live = (state.engine?.state ?? 'idle') !== 'idle';
  return { ...state, view, elapsedMs, summary, live, start, stop, skip, error };
}
