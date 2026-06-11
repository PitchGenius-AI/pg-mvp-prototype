import { DemoOverlay, LiveOverlay } from './components/Overlay';
import { OnboardingFlow } from './onboarding/OnboardingFlow';
import { useOnboardingComplete } from './mock/store';

// The same overlay view renders in two contexts from one codebase, differing
// only in its event source:
//  - Real Tauri app: LiveOverlay drives the Rust audio engine (mic → STT) and
//    fills the transparent floating NSPanel (PG-244 shell).
//  - Plain browser (QA/iteration): DemoOverlay replays the scripted fixture, and
//    `.demo-stage` paints a stand-in backdrop so the glass translucency reads.
// Tauri v2 always injects `__TAURI_INTERNALS__`, regardless of withGlobalTauri.
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export default function App() {
  // First-run onboarding (§4.6, PG-281) gates the overlay. It is fully skippable
  // (2026-06-10) — `onboardingComplete` flips when the seller finishes OR skips,
  // not on having ≥1 product — and is persisted to localStorage, so it only
  // appears on a true cold start (or after a store reset).
  const onboarded = useOnboardingComplete();
  const content = !onboarded ? <OnboardingFlow /> : inTauri ? <LiveOverlay /> : <DemoOverlay />;

  if (inTauri) {
    return <div className="tauri-root">{content}</div>;
  }

  return (
    <div className="demo-stage">
      <span className="demo-tag">Browser demo · fixture-driven (no audio)</span>
      {content}
    </div>
  );
}
