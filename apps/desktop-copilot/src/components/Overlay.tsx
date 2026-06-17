import { useEffect, useRef, useState } from 'react';
import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window';
import type {
  CueEvent,
  DiscProfile,
  EngineStateEvent,
  MaterialSignal,
  MaterialSignalEvent,
  SalesTechnique,
  TechniqueUpdateEvent,
  TranscriptEvent,
} from '@pg/shared';
import { useFixturePlayer } from '../mock/useFixturePlayer';
import { useRealtimeEngine } from '../realtime/useRealtimeEngine';
import { useBoundCallContext } from '../api/useBoundCallContext';
import { buyerProfile, sellerProfile, type DemoProfile } from '../mock/profiles';
import { formatClock, type CallSummary, type CallView } from '../session';

const TECHNIQUE_LABEL: Record<SalesTechnique, string> = {
  spin: 'SPIN',
  challenger: 'Challenger',
  nepq: 'NEPQ',
};

type PillKey = 'transcript' | 'seller' | 'buyer' | 'technique';

// — Status line (§5.1): engine state · phase · Discovery n/total · confidence creep.
// Carries the manual-skip control (§5.2/§5.4): a small, unobtrusive "Skip ›" — the
// stall-breaker the seller reaches for when STT mishears and the cue won't
// auto-advance. Auto-advance stays the headline; this is the backup. (The global
// hotkey is the primary control and lands next increment.)
function StatusLine({
  engine,
  onSkip,
  canSkip,
}: {
  engine: EngineStateEvent | null;
  onSkip?: () => void;
  canSkip?: boolean;
}) {
  const state = engine?.state ?? 'idle';
  const phase = engine?.phase ?? 'discovery';
  const progress = engine?.discoveryProgress ?? null;
  const conf = engine?.techniqueConfidence ?? null;

  const stateLabel =
    state === 'no_audio'
      ? "Can't hear the call"
      : state === 'processing'
        ? 'Thinking…'
        : state === 'listening'
          ? 'Listening'
          : 'Idle';

  return (
    <div className="status-line" data-tauri-drag-region>
      <span className={`status-dot status-dot--${state}`} />
      <span className="status-state">{stateLabel}</span>
      <span className="status-sep">·</span>
      <span className="status-phase">
        {phase === 'live' ? 'Live' : progress ? `Discovery ${progress.done}/${progress.total}` : 'Discovery'}
      </span>
      {conf && (
        <>
          <span className="status-sep">·</span>
          <span className={`status-conf status-conf--${conf}`}>{conf}</span>
        </>
      )}
      {onSkip && canSkip && (
        <button
          type="button"
          className="status-skip"
          onClick={onSkip}
          title="Skip to the next prompt (manual)"
        >
          Skip ›
        </button>
      )}
    </div>
  );
}

// — Material-signal beat (§5.3): a brief acknowledgment that the planner caught
// something in the buyer's speech and is re-planning toward it. Shown while the
// (un-prefetchable) re-plan generation runs; cleared when the new head surfaces.
const SIGNAL_LABEL: Record<MaterialSignal, string> = {
  objection: 'Caught an objection — re-planning to handle it',
  buying_signal: 'Buying signal — re-planning to advance',
  new_stakeholder: 'New stakeholder — re-planning the decision map',
  pricing: 'Pricing raised — re-planning toward value',
};

function SignalBeat({ signal }: { signal: MaterialSignalEvent | null }) {
  if (!signal) return null;
  return (
    <div className={`signal-beat signal-beat--${signal.signal}`} data-tauri-drag-region>
      <span className="signal-beat-dot" />
      {SIGNAL_LABEL[signal.signal]}
    </div>
  );
}

// — The hero (§5.1): one two-tier cue at a time, rendered in its lifecycle state.
function CueHero({ cue }: { cue: CueEvent | null }) {
  if (!cue) {
    return (
      <div className="cue cue--empty">
        <span className="cue-empty-text">Start a call to begin coaching</span>
      </div>
    );
  }

  return (
    <div className={`cue cue--${cue.state}`}>
      <div className="cue-meta">
        {cue.technique ? (
          <span className="cue-technique">{TECHNIQUE_LABEL[cue.technique]}</span>
        ) : (
          <span className="cue-technique cue-technique--neutral">Discovery</span>
        )}
        {cue.state === 'processing' && <span className="cue-working">reading the room…</span>}
      </div>

      <div className="cue-trigger">{cue.trigger}</div>
      <div className="cue-example">{cue.example}</div>

      {cue.state === 'success' && cue.takeaway && (
        <div className="cue-takeaway">
          <span className="cue-check">✓</span>
          {cue.takeaway}
        </div>
      )}
    </div>
  );
}

// — End-of-call summary card (§5.7). Replaces the hero when the call ends. v1 is a
// basic summary only (full post-call analysis is out of scope) derived entirely from
// the reduced PlayerState — no engine-emitted summary event. The "Open in Pitch
// Genius" CTA is the §11/§4.1 web handoff, mocked in the prototype (the real embedded
// webview + shared store isn't built yet). Resume is the next sub-increment; this
// card leaves room for it and the call record is preserved (not cleared) on End. —
function SummaryRow({
  label,
  children,
  muted = false,
}: {
  label: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="summary-row">
      <span className="summary-row-label">{label}</span>
      <span className={`summary-row-value${muted ? ' summary-row-value--muted' : ''}`}>{children}</span>
    </div>
  );
}

function SummaryCard({ summary }: { summary: CallSummary }) {
  // The deeplink handoff is mocked in the prototype — clicking shows inline
  // confirmation rather than launching the (not-yet-built) embedded web app (§11).
  const [opened, setOpened] = useState(false);
  const buyer = summary.buyer;
  const [primary, secondary] = buyer ? discRanked(buyer.disc) : [null, null];
  const tech = summary.technique;
  return (
    <div className="summary-card">
      <div className="summary-card-head">
        <span className="summary-card-title">Call ended</span>
        <span className="summary-card-duration">{formatClock(summary.durationMs)}</span>
      </div>

      <div className="summary-rows">
        <SummaryRow label="Discovery">
          {summary.discoveryCompleted}/{summary.discoveryTotal} cues
        </SummaryRow>
        <SummaryRow label="Buyer">
          {buyer ? (
            <>
              <span className="summary-disc">
                {primary}
                {secondary ? ` / ${secondary}` : ''}
              </span>
              <span className="summary-oneliner">{buyer.summary}</span>
            </>
          ) : (
            'not read this call'
          )}
        </SummaryRow>
        <SummaryRow label="Technique">
          {tech ? (
            <>
              {TECHNIQUE_LABEL[tech.technique]} <span className="summary-tier">· {tech.tier}</span>
            </>
          ) : (
            'not matched'
          )}
        </SummaryRow>
        {/* Pipeline-stage read isn't in the desktop contract yet (§6) — honest stub
            for v1 rather than inventing a stage. */}
        <SummaryRow label="Pipeline" muted>
          not yet read
        </SummaryRow>
      </div>

      <button
        type="button"
        className="summary-cta"
        onClick={() => setOpened(true)}
        disabled={opened}
      >
        {opened ? 'Opening Pitch Genius…' : 'Open in Pitch Genius'}
      </button>
      {opened && <p className="summary-cta-note">Web handoff is mocked in the prototype (§11).</p>}
    </div>
  );
}

// — Reveal pills (§5.4): collapsed by default, mutually exclusive panels. —
function RevealPills({
  open,
  onSelect,
  buyerPulse,
}: {
  open: PillKey | null;
  onSelect: (k: PillKey) => void;
  buyerPulse: boolean;
}) {
  const pills: Array<{ key: PillKey; label: string }> = [
    { key: 'transcript', label: 'Transcript' },
    { key: 'seller', label: 'Seller' },
    { key: 'buyer', label: 'Buyer' },
    { key: 'technique', label: 'Technique' },
  ];
  return (
    <div className="pills">
      {pills.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`pill${open === p.key ? ' pill--active' : ''}`}
          onClick={() => onSelect(p.key)}
        >
          {p.label}
          {p.key === 'buyer' && buyerPulse && <span className="pill-dot" />}
        </button>
      ))}
    </div>
  );
}

// — Profile rendering (DISC primary/secondary + OCEAN bars + summary, §4.4) —
function ScoreBar({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill${accent ? ' bar-fill--accent' : ''}`} style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

function discRanked(disc: DiscProfile): Array<'D' | 'I' | 'S' | 'C'> {
  const entries: Array<['D' | 'I' | 'S' | 'C', number]> = [
    ['D', disc.d],
    ['I', disc.i],
    ['S', disc.s],
    ['C', disc.c],
  ];
  return entries.sort((a, b) => b[1] - a[1]).map(([k]) => k);
}

function ProfileBody({ profile }: { profile: DemoProfile }) {
  const [primary = 'D', secondary = 'I'] = discRanked(profile.disc);
  return (
    <>
      <div className="disc-line">
        <span className="disc-letter">{primary}</span>
        <span className="disc-tag">primary</span>
        <span className="disc-letter disc-letter--secondary">{secondary}</span>
        <span className="disc-tag">secondary</span>
      </div>
      <div className="bars">
        <ScoreBar label="O" value={profile.ocean.o} />
        <ScoreBar label="C" value={profile.ocean.c} />
        <ScoreBar label="E" value={profile.ocean.e} />
        <ScoreBar label="A" value={profile.ocean.a} />
        <ScoreBar label="N" value={profile.ocean.n} />
      </div>
      <p className="panel-summary">{profile.summary}</p>
    </>
  );
}

// — The four panels — //
function TranscriptPanel({ transcript }: { transcript: TranscriptEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [transcript.length]);

  const recent = transcript.slice(-6);
  return (
    <div className="panel">
      <div className="panel-head">Transcript</div>
      <div className="transcript-body">
        {recent.length === 0 && <p className="panel-note">No speech yet</p>}
        {recent.map((t) => (
          <div key={t.id} className={`bubble bubble--${t.speaker}`}>
            <span className="bubble-who">{t.speaker === 'seller' ? 'You' : 'Buyer'}</span>
            <span className="bubble-text">{t.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function SellerPanel() {
  return (
    <div className="panel">
      <div className="panel-head">Seller · how we coach you</div>
      <ProfileBody profile={sellerProfile} />
    </div>
  );
}

function BuyerPanel({
  engine,
  profile,
  preparing = false,
}: {
  engine: EngineStateEvent | null;
  profile: DemoProfile | null;
  preparing?: boolean;
}) {
  const phase = engine?.phase ?? 'discovery';
  const done = engine?.discoveryProgress?.done ?? 0;
  const total = engine?.discoveryProgress?.total ?? 3;
  // A bound pre-call preview: a profile is supplied before the live engine exists —
  // it's the deal's already-matched read, not something building live (PG-313).
  const preview = !engine && !!profile;
  // Started once the buyer has been read at all — the first live profile arrives a
  // beat before discovery progress ticks, so key off either — or whenever we have a
  // pre-call read to show.
  const started = preview || (!!engine && (phase === 'live' || done > 0 || !!profile));

  if (!started) {
    return (
      <div className="panel">
        <div className="panel-head">Buyer</div>
        <p className="panel-note">
          {preparing
            ? 'Loading this deal’s buyer profile…'
            : 'Listening for the buyer… the profile builds as they answer.'}
        </p>
      </div>
    );
  }

  const locked = phase === 'live';
  // The live profile once it's scored; the seeded read as a placeholder until then.
  const shown = profile ?? buyerProfile;
  return (
    <div className="panel">
      <div className="panel-head">
        Buyer
        {preview ? (
          <span className="badge badge--locked">from pre-call prep</span>
        ) : (
          <span className={`badge ${locked ? 'badge--locked' : 'badge--building'}`}>
            {locked ? 'locked' : `building ${done}/${total}`}
          </span>
        )}
      </div>
      <ProfileBody profile={shown} />
    </div>
  );
}

// The matched technique + tier + rationale. Live off `technique_update` (§5.4)
// during the call; pre-fillable from the deal's pre-call prep before it starts
// (PG-313). Empty until the first buyer answer is scored (cold start) — mirroring
// the Buyer panel's empty-then-fill "watch it learn" beat.
function TechniquePanel({
  technique,
  preparing = false,
}: {
  technique: TechniqueUpdateEvent | null;
  preparing?: boolean;
}) {
  if (!technique) {
    return (
      <div className="panel">
        <div className="panel-head">Technique</div>
        <p className="panel-note">
          {preparing
            ? 'Loading this deal’s matched technique…'
            : 'Evaluating… matching a technique to how this buyer buys.'}
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        Technique
        <span className={`badge badge--${technique.tier}`}>{technique.tier}</span>
      </div>
      <div className="technique-name">{TECHNIQUE_LABEL[technique.technique]}</div>
      <p className="panel-summary">{technique.rationale}</p>
    </div>
  );
}

// The composed overlay — pure presentation. It has no idea whether its events
// come off live audio (LiveOverlay) or a scripted fixture (DemoOverlay): both
// feed it the same reduced PlayerState. `onStartStop` drives the Start/End call
// control; when omitted (browser demo) the control is inert.
// Live app only: keep the floating glass card sized to its content. The overlay
// window is created at a nominal size; as panels open/collapse or fill, we resize
// the NSPanel to the card's measured height (width is fixed by CSS) so a short or
// collapsed view doesn't leave empty glass — or a transparent dead click-zone —
// below the card. No-op in the browser demo, where the card just flows in the page.
const WINDOW_WIDTH = 392; // matches tauri.conf.json window width
const TAURI_GUTTER = 56; // .tauri-root padding (28px) top + bottom

export function useFitWindowToContent(ref: React.RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    let raf = 0;
    const fit = () => {
      const height = Math.ceil(el.getBoundingClientRect().height) + TAURI_GUTTER;
      void getCurrentWindow().setSize(new LogicalSize(WINDOW_WIDTH, height)).catch(() => {});
    };
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
}

interface OverlayViewProps {
  transcript: TranscriptEvent[];
  cue: CueEvent | null;
  engine: EngineStateEvent | null;
  buyerProfile: DemoProfile | null;
  technique: TechniqueUpdateEvent | null;
  signal: MaterialSignalEvent | null;
  // Frontend-only call session (§5.7): view drives the rail control + the summary
  // card; elapsedMs is the §5.1 live timer; summary is the end-of-call snapshot.
  view: CallView;
  elapsedMs: number;
  summary: CallSummary | null;
  onStartStop?: () => void;
  // Manual-skip (§5.2/§5.4): advance to the next prompt. When omitted the control
  // is hidden; both live and fixture providers supply it (the fixture as a local
  // fast-forward), so the button works in both.
  onSkip?: () => void;
  error?: string | null;
  // Bound call only: the pre-grounding payload (buyer read + technique + script) is
  // still being fetched. Start is disabled until it resolves so a too-early click
  // can't silently begin a cold call without the deal's prep (PG-313).
  preparing?: boolean;
  // Human-readable note about what the prep is doing (loading vs generating), shown
  // while `preparing` so the wait isn't a silent spinner (PG-313).
  prepStatus?: string | null;
  // True in the live Tauri app: keep the window sized to the card's content.
  fitWindow?: boolean;
}

export function OverlayView({
  transcript,
  cue,
  engine,
  buyerProfile: liveBuyerProfile,
  technique,
  signal,
  view,
  elapsedMs,
  summary,
  onStartStop,
  onSkip,
  error,
  preparing = false,
  prepStatus,
  fitWindow = false,
}: OverlayViewProps) {
  // null = the panel section is minimized (no panel open). Clicking the active
  // pill again collapses it, so the pill doubles as the minimize control — no
  // separate minimize button.
  const [open, setOpen] = useState<PillKey | null>('transcript');
  const [detectable, setDetectable] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  useFitWindowToContent(shellRef, fitWindow);

  // Drive the rail control off the view, not the raw engine state: in the summary
  // view the engine briefly still reads `listening` until its idle echo lands, but
  // the control should already offer "Start call" (a fresh call), not "End call".
  const inCall = view === 'live';
  const inSummary = view === 'summary' && !!summary;
  const buyerPulse =
    (engine?.phase ?? 'discovery') === 'discovery' && (engine?.discoveryProgress?.done ?? 0) > 0;

  const togglePill = (k: PillKey) => setOpen((cur) => (cur === k ? null : k));

  return (
    <div className="overlay-shell" data-tauri-drag-region ref={shellRef}>
      <div className="rail" data-tauri-drag-region>
        <span className="rail-brand" data-tauri-drag-region>
          <span className="rail-dot" data-tauri-drag-region />
          Pitch Genius
        </span>
        <div className="rail-controls">
          {inCall && (
            <span className="rail-clock" data-tauri-drag-region>
              {formatClock(elapsedMs)}
            </span>
          )}
          <button
            type="button"
            className={`toggle${detectable ? ' toggle--on' : ''}`}
            onClick={() => setDetectable((d) => !d)}
            title="Screen-share visibility"
          >
            {detectable ? 'Detectable' : 'Hidden'}
          </button>
          <button
            type="button"
            className={`rail-call ${inCall ? 'rail-call--live' : ''}`}
            onClick={onStartStop}
            disabled={!onStartStop || (!inCall && preparing)}
          >
            {inCall ? '● End call' : preparing ? 'Preparing…' : 'Start call'}
          </button>
        </div>
      </div>

      {error && <div className="engine-error">{error}</div>}
      {preparing && prepStatus && <p className="panel-note overlay-prep-note">{prepStatus}</p>}

      {inSummary ? (
        <SummaryCard summary={summary} />
      ) : (
        <>
          <StatusLine engine={engine} onSkip={onSkip} canSkip={view === 'live' && !!cue} />
          <SignalBeat signal={signal} />
          <CueHero cue={cue} />

          {/* Pills sit directly above the panel they toggle; the active pill is also
              the collapse control. */}
          <RevealPills open={open} onSelect={togglePill} buyerPulse={buyerPulse} />

          {open && (
            <div className="panel-area">
              {open === 'transcript' && <TranscriptPanel transcript={transcript} />}
              {open === 'seller' && <SellerPanel />}
              {open === 'buyer' && (
                <BuyerPanel engine={engine} profile={liveBuyerProfile} preparing={preparing} />
              )}
              {open === 'technique' && <TechniquePanel technique={technique} preparing={preparing} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Real Tauri app: the live audio engine (mic → VAD → Deepgram STT → events).
// `opportunityId` (PG-292) binds the call to a deal: the pre-grounding payload is
// pre-fetched on bind and handed to `start`, so the planner skips discovery and
// drives from the prepared script. Null is a cold start (live discovery).
export function LiveOverlay({ opportunityId }: { opportunityId: string | null }) {
  const {
    transcript,
    cue,
    engine,
    buyerProfile,
    technique,
    signal,
    view,
    elapsedMs,
    summary,
    start,
    stop,
    skip,
    error,
  } = useRealtimeEngine();
  const {
    context,
    preview,
    loading: contextLoading,
    status,
    error: contextError,
  } = useBoundCallContext(opportunityId);
  // A bound launch whose prep is still in flight: hold Start until `context` is
  // ready so an early click can't begin the call cold without the buyer read +
  // technique (the bug this fixes, PG-313). Cold start (no opportunityId) is never
  // "preparing". The watchdog in the hook clears `loading` so this can't hang forever.
  const preparing = opportunityId !== null && contextLoading;

  // Pre-call preview: show the deal's already-matched buyer read + technique in the
  // panels before the call starts (from the fast preview, or the full context once
  // it lands). During the live call the engine's own events take over.
  const inLiveCall = view === 'live';
  const previewProfile: DemoProfile | null = inLiveCall
    ? null
    : (preview?.buyerProfile ?? context?.buyerProfile ?? null);
  const previewTech = inLiveCall ? null : (preview?.technique ?? context?.technique ?? null);
  const previewTechnique: TechniqueUpdateEvent | null = previewTech
    ? {
        type: 'technique_update',
        technique: previewTech.technique,
        tier: 'locked',
        rationale: previewTech.reasoning,
      }
    : null;

  // What the wait is for, in words (PG-313): a plain load vs. a first-time LLM generation.
  const prepStatus =
    status === 'generating'
      ? 'Generating pre-call intelligence for this deal (first time — this can take ~20s)…'
      : status === 'loading'
        ? 'Loading this deal’s buyer profile & technique…'
        : null;

  return (
    <OverlayView
      transcript={transcript}
      cue={cue}
      engine={engine}
      // Pre-call: the deal's matched read/technique; live: the engine's own events.
      buyerProfile={previewProfile ?? buyerProfile}
      technique={previewTechnique ?? technique}
      signal={signal}
      view={view}
      elapsedMs={elapsedMs}
      summary={summary}
      // Engine errors take priority; otherwise surface a prep failure so a bound
      // call that degraded to cold start says so instead of looking empty.
      error={error ?? contextError}
      preparing={preparing}
      prepStatus={prepStatus}
      // In-call → End; precall/summary → Start a fresh call (§5.7: a new call is a
      // distinct action from Resume). When bound, Start carries the pre-grounding
      // context; the button is disabled while `preparing` so it's never null-on-click.
      onStartStop={view === 'live' ? stop : () => start(context)}
      onSkip={skip}
      fitWindow
    />
  );
}

// Browser/QA: the scripted fixture, no audio. Auto-plays on a loop (including the
// §5.7 summary beat before it restarts), so the Start/End control is inert.
export function DemoOverlay() {
  const { transcript, cue, engine, buyerProfile, technique, signal, view, elapsedMs, summary, skip } =
    useFixturePlayer();
  return (
    <OverlayView
      transcript={transcript}
      cue={cue}
      engine={engine}
      buyerProfile={buyerProfile}
      technique={technique}
      signal={signal}
      view={view}
      elapsedMs={elapsedMs}
      summary={summary}
      onSkip={skip}
    />
  );
}
