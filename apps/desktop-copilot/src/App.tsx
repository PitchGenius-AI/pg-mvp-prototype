import { useEffect, useState } from 'react';
import { DemoOverlay, LiveOverlay } from './components/Overlay';
import { ConnectScreen } from './components/ConnectScreen';
import { OpportunityPicker } from './components/OpportunityPicker';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { useOnboardingComplete } from './mock/store';
import { useCopilotAuth } from './api/auth';

// The same overlay view renders in two contexts from one codebase, differing
// only in its event source:
//  - Real Tauri app: LiveOverlay drives the Rust audio engine (mic → STT) and
//    fills the transparent floating NSPanel (PG-244 shell).
//  - Plain browser (QA/iteration): DemoOverlay replays the scripted fixture, and
//    `.demo-stage` paints a stand-in backdrop so the glass translucency reads.
// Tauri v2 always injects `__TAURI_INTERNALS__`, regardless of withGlobalTauri.
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export default function App() {
  // Auth/backend (PG-289) only applies to the real Tauri app; the browser demo is
  // fixture-driven with no backend. Split into two components so each calls its own
  // hooks unconditionally.
  return inTauri ? <TauriApp /> : <BrowserApp />;
}

// The rep's launch decision (PG-291): bind to an opportunity, or start cold. Held
// until made; a `session/{id}` deeplink decides it automatically (binds, skips the
// picker). The bound id is consumed by start_call/planner pre-grounding in PG-292.
interface LaunchChoice {
  decided: boolean;
  opportunityId: string | null;
}

function TauriApp() {
  // PG-289: gate the overlay on a real session. The web app hands off a one-time
  // token via the pitchgenius:// deeplink; until it's exchanged (or a stored
  // session is restored), show the connect/sign-in screen. Once authenticated, the
  // first-run onboarding (§4.6) gate, then the opportunity picker (PG-291), apply
  // before the live overlay.
  const auth = useCopilotAuth();
  const onboarded = useOnboardingComplete();
  const [launch, setLaunch] = useState<LaunchChoice>({ decided: false, opportunityId: null });

  // Launched FROM a deal (deeplink named an opportunity) → bind directly, skip the
  // picker (PG-291 entry routing).
  useEffect(() => {
    if (auth.pendingOpportunityId && !launch.decided) {
      setLaunch({ decided: true, opportunityId: auth.pendingOpportunityId });
    }
  }, [auth.pendingOpportunityId, launch.decided]);

  let content;
  if (auth.status === 'loading') {
    content = <ConnectScreen inTauri={inTauri} variant="loading" />;
  } else if (auth.status === 'unauthenticated') {
    content = (
      <ConnectScreen
        inTauri={inTauri}
        variant="signin"
        onConnect={auth.connect}
        error={auth.error}
      />
    );
  } else if (!onboarded) {
    content = <OnboardingFlow />;
  } else if (!launch.decided) {
    content = (
      <OpportunityPicker
        inTauri={inTauri}
        onBind={(opportunityId) => setLaunch({ decided: true, opportunityId })}
        onColdStart={() => setLaunch({ decided: true, opportunityId: null })}
      />
    );
  } else {
    // PG-292: the bound opportunity id flows into the overlay, which pre-fetches the
    // pre-grounding payload and hands it to start_call (a cold start passes null).
    content = <LiveOverlay opportunityId={launch.opportunityId} />;
  }

  return <div className="tauri-root">{content}</div>;
}

function BrowserApp() {
  // First-run onboarding (§4.6, PG-281) gates the overlay. It is fully skippable
  // (2026-06-10) — `onboardingComplete` flips when the seller finishes OR skips —
  // and is persisted to localStorage, so it only appears on a true cold start.
  const onboarded = useOnboardingComplete();
  const content = onboarded ? <DemoOverlay /> : <OnboardingFlow />;

  return (
    <div className="demo-stage">
      <span className="demo-tag">Browser demo · fixture-driven (no audio)</span>
      {content}
    </div>
  );
}
