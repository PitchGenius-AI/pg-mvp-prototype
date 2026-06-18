import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
import { copilotData, type BuyerIdentity } from '../api/copilot-data';
import { buyerProfile, type DemoProfile } from '../mock/profiles';
import { formatClock, type CallSummary, type CallView } from '../session';

const TECHNIQUE_LABEL: Record<SalesTechnique, string> = {
  spin: 'SPIN',
  challenger: 'Challenger',
  nepq: 'NEPQ',
};

// Seller pill CUT (Russell, 2026-06-15) — product intelligence is buyer-only.
type PillKey = 'transcript' | 'buyer' | 'technique';

// — Status line (§5.1): engine state · phase · Discovery n/total · confidence creep.
// Carries the manual-skip control (§5.2/§5.4): a small, unobtrusive "Skip ›" — the
// stall-breaker the seller reaches for when STT mishears and the cue won't
// auto-advance. Auto-advance stays the headline; this is the backup. (The global
// hotkey is the primary control and lands next increment.)
function StatusLine({
  engine,
  prepTechnique,
  onSkip,
  canSkip,
}: {
  engine: EngineStateEvent | null;
  prepTechnique?: TechniqueUpdateEvent | null;
  onSkip?: () => void;
  canSkip?: boolean;
}) {
  // Pre-call (no live engine yet): the planner hasn't chosen a phase, so don't assert
  // "Discovery" — it misleads on a bound/prepped call, which skips discovery entirely
  // once it starts (the read + technique came from pre-call prep; see PG-276). Show
  // "Ready" + the prepped technique (when bound) so the prep reads clearly before Start.
  if (!engine) {
    return (
      <div className="status-line" data-tauri-drag-region>
        <span className="status-dot status-dot--idle" />
        <span className="status-state">Ready</span>
        {prepTechnique && (
          <>
            <span className="status-sep">·</span>
            <span className="status-phase">{TECHNIQUE_LABEL[prepTechnique.technique]}</span>
            <span className="status-sep">·</span>
            <span className="status-conf status-conf--locked">{prepTechnique.tier}</span>
          </>
        )}
      </div>
    );
  }

  const state = engine.state;
  const phase = engine.phase;
  const progress = engine.discoveryProgress ?? null;
  const conf = engine.techniqueConfidence ?? null;

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

// Post-call save-back confirmation (PG-294) — shown under the summary card after a
// bound call writes its activity + enqueues the readiness diagnosis.
function CallSaveNote({ status }: { status: CallSaveStatus }) {
  const text =
    status === 'saving'
      ? 'Saving this call to your pipeline…'
      : status === 'saved'
        ? 'Saved — buyer readiness is updating from this call.'
        : "Couldn't save this call automatically — it can still be added from the web app.";
  return <p className={`panel-note call-save-note call-save-note--${status}`}>{text}</p>;
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
// The window is a fixed size (see tauri.conf.json + the .tauri-root CSS); it no
// longer resizes to fit content, so there is no window-fit hook — only the per-pill
// .panel-area scrolls, everything else stays put.

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
  // Post-call save-back state (PG-294): a bound call writes an activity + enqueues a
  // diagnosis on End; this surfaces "saving / saved / failed" on the summary card.
  saveStatus?: CallSaveStatus | null;
  // Bound-call confirm header (PG-317): the buyer's name/company/title, so the rep
  // can verify they launched into the right person's call. Null on a cold start.
  buyerIdentity?: BuyerIdentity | null;
  // Pre-call back affordance (PG-316): return to the opportunity picker to pick a
  // different deal (or switch to/from a cold start). Omitted in the browser demo.
  onChangeDeal?: () => void;
}

// Post-call save-back lifecycle (PG-294).
export type CallSaveStatus = 'saving' | 'saved' | 'error';

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
  saveStatus,
  buyerIdentity,
  onChangeDeal,
}: OverlayViewProps) {
  // null = the panel section is minimized (no panel open). Clicking the active
  // pill again collapses it, so the pill doubles as the minimize control — no
  // separate minimize button.
  const [open, setOpen] = useState<PillKey | null>('transcript');
  // Default Hidden (§5.4): the overlay is excluded from screen capture until the rep
  // opts into Detectable. Rust applies the same default at startup; this effect keeps
  // the native NSWindow sharing type in sync with the toggle. No-op in the browser
  // demo (no Tauri bridge), so the control is inert there.
  const [detectable, setDetectable] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
      void invoke('set_detectable', { detectable }).catch(() => {});
    }
  }, [detectable]);

  // Drive the rail control off the view, not the raw engine state: in the summary
  // view the engine briefly still reads `listening` until its idle echo lands, but
  // the control should already offer "Start call" (a fresh call), not "End call".
  const inCall = view === 'live';
  const inSummary = view === 'summary' && !!summary;
  const buyerPulse =
    (engine?.phase ?? 'discovery') === 'discovery' && (engine?.discoveryProgress?.done ?? 0) > 0;

  const togglePill = (k: PillKey) => setOpen((cur) => (cur === k ? null : k));

  return (
    <div className="overlay-shell" data-tauri-drag-region>
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

      {/* Bound-call confirm bar (PG-316 back / PG-317 identity). The back link only
          shows pre-call (before a live call); the identity stays visible throughout
          so the rep can keep confirming who they're on with. Hidden entirely on a
          cold start with no picker (browser demo). */}
      {(buyerIdentity || (onChangeDeal && !inCall && !inSummary)) && (
        <div className="bound-bar" data-tauri-drag-region>
          {onChangeDeal && !inCall && !inSummary && (
            <button type="button" className="bound-back" onClick={onChangeDeal}>
              ‹ Back to deals
            </button>
          )}
          {buyerIdentity && (
            <span className="bound-id">
              <span className="bound-id-name">{buyerIdentity.name}</span>
              {(buyerIdentity.company || buyerIdentity.title) && (
                <span className="bound-id-org">
                  {[buyerIdentity.company, buyerIdentity.title].filter(Boolean).join(' · ')}
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {error && <div className="engine-error">{error}</div>}
      {preparing && prepStatus && <p className="panel-note overlay-prep-note">{prepStatus}</p>}

      {inSummary ? (
        <>
          <SummaryCard summary={summary} />
          {saveStatus && <CallSaveNote status={saveStatus} />}
        </>
      ) : (
        <>
          <StatusLine
            engine={engine}
            prepTechnique={technique}
            onSkip={onSkip}
            canSkip={view === 'live' && !!cue}
          />
          <SignalBeat signal={signal} />
          <CueHero cue={cue} />

          {/* Pills sit directly above the panel they toggle; the active pill is also
              the collapse control. */}
          <RevealPills open={open} onSelect={togglePill} buyerPulse={buyerPulse} />

          {open && (
            <div className="panel-area">
              {open === 'transcript' && <TranscriptPanel transcript={transcript} />}
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
export function LiveOverlay({
  opportunityId,
  onChangeDeal,
}: {
  opportunityId: string | null;
  // PG-316: return to the opportunity picker before the call starts.
  onChangeDeal?: () => void;
}) {
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
    identity,
    loading: contextLoading,
    status,
    error: contextError,
  } = useBoundCallContext(opportunityId);
  // A bound launch whose prep is still in flight: hold Start until `context` is
  // ready so an early click can't begin the call cold without the buyer read +
  // technique (the bug this fixes, PG-313). Cold start (no opportunityId) is never
  // "preparing". The watchdog in the hook clears `loading` so this can't hang forever.
  const preparing = opportunityId !== null && contextLoading;

  // Post-call save-back (PG-294). On End of a BOUND call, write the call as an
  // activity + enqueue a readiness diagnosis so the deal updates from the
  // conversation. Read `transcript` at click time (it holds the accumulated chunks).
  // Cold-start calls (no opportunityId) aren't saved here — the create-new-lead path
  // is separate. An empty transcript is skipped so we don't diagnose on nothing.
  const [saveStatus, setSaveStatus] = useState<CallSaveStatus | null>(null);
  const endAndSave = () => {
    stop();
    if (opportunityId && transcript.length > 0) {
      setSaveStatus('saving');
      copilotData
        .saveBoundCall({ opportunityId, transcript })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('error'));
    }
  };

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
      saveStatus={saveStatus}
      buyerIdentity={identity}
      onChangeDeal={onChangeDeal}
      // In-call → End (which also saves the call back, PG-294); precall/summary →
      // Start a fresh call (§5.7: a new call is a distinct action from Resume). When
      // bound, Start carries the pre-grounding context; the button is disabled while
      // `preparing` so it's never null-on-click. Starting fresh clears the save note.
      onStartStop={
        view === 'live'
          ? endAndSave
          : () => {
              setSaveStatus(null);
              start(context);
            }
      }
      onSkip={skip}
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
