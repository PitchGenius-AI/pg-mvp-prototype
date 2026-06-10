import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CueEvent,
  EngineStateEvent,
  MaterialSignalEvent,
  RealtimeEvent,
  TechniqueUpdateEvent,
  TranscriptEvent,
} from '@pg/shared';
import { fixture, FIXTURE_LOOP_MS } from './fixture';
import type { DemoProfile } from './profiles';
import {
  buildCallSummary,
  trackDiscovery,
  type CallSummary,
  type CallView,
} from '../session';

// Plays the scripted fixture into React state on its own timeline, then loops.
// This is the demo stand-in for the Tauri event subscription: when the real
// engine lands, this hook is replaced by `listen(REALTIME_EVENT_CHANNEL, …)` and
// nothing downstream changes — the overlay consumes the same reduced state.

export interface PlayerState {
  transcript: TranscriptEvent[];
  cue: CueEvent | null;
  engine: EngineStateEvent | null;
  // The buyer DISC/OCEAN profile built live from `profile_update` events (§5.4).
  // null until the first buyer answer is scored — that emptiness-then-fill is the
  // "watch it learn" payoff. Seller updates aren't live-scored yet, so ignored.
  buyerProfile: DemoProfile | null;
  // The live technique match from `technique_update` events (§5.4 Technique panel).
  // null until the first buyer answer is scored — the panel shows "Evaluating…"
  // until then, then fills with the matched technique + tier + rationale.
  technique: TechniqueUpdateEvent | null;
  // The current material-signal beat (§5.3), set when the planner re-plans on a buyer
  // signal and cleared when the freshly-planned head surfaces (the next `prompt` cue).
  // Transient by design — it acknowledges the engine reacting while the re-plan runs.
  signal: MaterialSignalEvent | null;
}

// The fixture's session view: the same frontend-only call-session fields the live
// hook exposes (§5.7), so the overlay renders the summary card identically off the
// scripted run with no API key. The fixture flips to the summary at the end of its
// timeline, lingers, then loops back to a fresh live run.
export interface FixturePlayer extends PlayerState {
  view: CallView;
  elapsedMs: number;
  summary: CallSummary | null;
  /** Manual skip (§5.2/§5.4): seek the timeline forward to the next cue PROMPT.
   *  The browser demo has no Rust planner, so skip is a *local fast-forward* —
   *  but the button does the same job as live (turn the page to the next prompt). */
  skip: () => void;
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
      // A fresh PROMPT (including the re-planned head) clears any signal beat — the
      // acknowledgment has done its job once the new cue lands on the hero.
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

// When the last content event has settled, the call "ends" → the summary card shows
// (reusing FIXTURE_LOOP_MS as the end-of-content beat), lingers for the dwell, then
// the loop restarts. The dwell gives QA time to read the card in the browser demo.
const SUMMARY_AT = FIXTURE_LOOP_MS;
const SUMMARY_DWELL = 6000;

// The timeline offsets of every cue PROMPT — the seek targets for manual skip
// (§5.2/§5.4). Skip jumps to the next prompt ahead of the playhead; past the last
// one, it jumps to the end-of-call summary.
const PROMPT_ATS = fixture
  .filter((f) => f.event.type === 'cue' && f.event.state === 'prompt')
  .map((f) => f.at);

export function useFixturePlayer(): FixturePlayer {
  const [state, setState] = useState<PlayerState>(EMPTY);
  const [view, setView] = useState<CallView>('live');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [summary, setSummary] = useState<CallSummary | null>(null);

  // The call's start time (for the clock) + the final accumulated state and discovery
  // progress (for the summary snapshot), tracked alongside the rendered state.
  const startedAtRef = useRef(0);
  const discoveryRef = useRef(0);
  const accRef = useRef<PlayerState>(EMPTY);
  // The current mount's seek function, captured so the stable `skip` callback can
  // fast-forward without re-subscribing.
  const seekRef = useRef<(offsetMs: number) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    let timers: number[] = [];
    const clearTimers = () => {
      timers.forEach((t) => clearTimeout(t));
      timers = [];
    };

    // Play the fixture starting at `offsetMs` into its timeline. Rebuilds the
    // reduced state from every event at or before the offset (so a seek lands on a
    // consistent state — engine, profile, transcript so far), then schedules the
    // remainder, the §5.7 summary, and the loop restart, all shifted by the offset.
    // Used for the initial play (offset 0), the loop restart, and manual skip.
    const playFrom = (offsetMs: number) => {
      clearTimers();

      // Base state = every event at or before the seek point, reduced in order.
      let base = EMPTY;
      let discovery = 0;
      for (const { at, event } of fixture) {
        if (at > offsetMs) break;
        base = applyEvent(base, event);
        if (event.type === 'engine_state') discovery = trackDiscovery(discovery, event);
      }
      accRef.current = base;
      discoveryRef.current = discovery;
      startedAtRef.current = Date.now() - offsetMs;
      setState(base);
      setSummary(null);
      setView('live');
      setElapsedMs(offsetMs);

      for (const { at, event } of fixture) {
        if (at <= offsetMs) continue;
        timers.push(
          window.setTimeout(() => {
            if (cancelled) return;
            accRef.current = applyEvent(accRef.current, event);
            if (event.type === 'engine_state') {
              discoveryRef.current = trackDiscovery(discoveryRef.current, event);
            }
            setState((s) => applyEvent(s, event));
          }, at - offsetMs),
        );
      }

      // End of call → the §5.7 summary card, built from the final accumulated state.
      timers.push(
        window.setTimeout(
          () => {
            if (cancelled) return;
            const acc = accRef.current;
            setSummary(
              buildCallSummary({
                buyer: acc.buyerProfile,
                technique: acc.technique,
                durationMs: SUMMARY_AT,
                discoveryCompleted: discoveryRef.current,
              }),
            );
            setElapsedMs(SUMMARY_AT);
            setView('summary');
          },
          Math.max(0, SUMMARY_AT - offsetMs),
        ),
      );

      timers.push(
        window.setTimeout(
          () => {
            if (!cancelled) playFrom(0);
          },
          Math.max(0, SUMMARY_AT + SUMMARY_DWELL - offsetMs),
        ),
      );
    };

    seekRef.current = (offsetMs: number) => {
      if (!cancelled) playFrom(offsetMs);
    };

    playFrom(0);
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, []);

  // The call clock ticks during the live run and freezes for the summary (§5.1).
  useEffect(() => {
    if (view !== 'live') return;
    const tick = () => setElapsedMs(Date.now() - startedAtRef.current);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [view]);

  // Manual skip (§5.2/§5.4): seek to the next cue PROMPT ahead of the playhead, or
  // to the end-of-call summary if we're past the last one. A local fast-forward —
  // the browser has no Rust planner — but the button behaves the same as live.
  const skip = useCallback(() => {
    const elapsed = Date.now() - startedAtRef.current;
    const next = PROMPT_ATS.find((at) => at > elapsed + 1);
    seekRef.current(next ?? SUMMARY_AT);
  }, []);

  return { ...state, view, elapsedMs, summary, skip };
}
