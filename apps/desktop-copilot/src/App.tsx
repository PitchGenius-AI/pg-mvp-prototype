import { DemoOverlay, LiveOverlay } from './components/Overlay';

// The same overlay view renders in two contexts from one codebase, differing
// only in its event source:
//  - Real Tauri app: LiveOverlay drives the Rust audio engine (mic → STT) and
//    fills the transparent floating NSPanel (PG-244 shell).
//  - Plain browser (QA/iteration): DemoOverlay replays the scripted fixture, and
//    `.demo-stage` paints a stand-in backdrop so the glass translucency reads.
// Tauri v2 always injects `__TAURI_INTERNALS__`, regardless of withGlobalTauri.
const inTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export default function App() {
  if (inTauri) {
    return (
      <div className="tauri-root">
        <LiveOverlay />
      </div>
    );
  }

  return (
    <div className="demo-stage">
      <span className="demo-tag">Browser demo · fixture-driven (no audio)</span>
      <DemoOverlay />
    </div>
  );
}
