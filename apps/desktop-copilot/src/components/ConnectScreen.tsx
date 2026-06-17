import { useState } from 'react';

// Pre-auth states for the desktop overlay (M33/PG-289). Shown before a session
// exists: a brief connecting splash while the auth boot runs, and a sign-in prompt
// when there's no stored/handed-off session. Auth itself is owned by the web app
// (UX_SPEC §4.1/§11) — the desktop never collects credentials; the rep signs in on
// the web and clicks "Start PG.AI PILOT", which hands a token to this app.
//
// Renders inside the same glass `overlay-shell` (with the native drag region and
// window-fit) as onboarding and the live overlay, so it reads as one app rather
// than a transparent, undraggable card.

interface ConnectScreenProps {
  variant: 'loading' | 'signin';
  /** Apply a pasted launch link / token — dev only (see DevConnect below). */
  onConnect?: (input: string) => Promise<void>;
  /** Last launch failure, surfaced so the rep isn't left guessing. */
  error?: string | null;
}

export function ConnectScreen({ variant, onConnect, error }: ConnectScreenProps) {
  return (
    <div className="overlay-shell" data-tauri-drag-region>
      <div className="rail" data-tauri-drag-region>
        <span className="rail-brand" data-tauri-drag-region>
          <span className="rail-dot" data-tauri-drag-region />
          PG.AI PILOT
        </span>
        <span className="ob-step-hint" data-tauri-drag-region>
          {variant === 'loading' ? 'Connecting' : 'Sign in'}
        </span>
      </div>

      <div className="ob-body">
        {variant === 'loading' ? (
          <p className="ob-sub">Connecting to your Pitch Genius account…</p>
        ) : (
          <>
            <h2 className="ob-title">Sign in to connect</h2>
            <p className="ob-sub">
              Open the Pitch Genius web app, then click <strong>Start PG.AI PILOT</strong> on a deal
              (or the Co-pilot screen) to hand this app your session.
            </p>
            {error && (
              <p className="ob-error" role="alert">
                {error}
              </p>
            )}
            {import.meta.env.DEV && onConnect && <DevConnect onConnect={onConnect} />}
          </>
        )}
      </div>
    </div>
  );
}

// Dev-only escape hatch: macOS `tauri dev` runs an unbundled binary, so the OS
// can't route `pitchgenius://` to it (the scheme lives in the bundle's Info.plist).
// Paste the launch link or one-time token (minted from the web app) to drive the
// exact same exchange → bind flow under `tauri dev` + HMR, no OS routing needed.
function DevConnect({ onConnect }: { onConnect: (input: string) => Promise<void> }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  // Await the exchange so the button reflects real progress and a failed token
  // doesn't silently no-op. `onConnect` surfaces its own error on the screen; we
  // just swallow the rejection here so it isn't an unhandled promise rejection.
  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    void onConnect(trimmed).finally(() => setBusy(false));
  };

  return (
    <div className="ob-field" style={{ marginTop: 6 }}>
      <span className="ob-field-label">Dev · paste launch link or token</span>
      <input
        className="ob-input"
        placeholder="pitchgenius://… or a one-time token"
        value={value}
        disabled={busy}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <button
        type="button"
        className="ob-cta ob-cta--inline"
        style={{ marginTop: 8, alignSelf: 'flex-start' }}
        disabled={!value.trim() || busy}
        onClick={submit}
      >
        {busy ? 'Connecting…' : 'Connect'}
      </button>
    </div>
  );
}
