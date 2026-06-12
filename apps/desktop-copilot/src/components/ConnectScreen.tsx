import { useRef, useState } from 'react';
import { useFitWindowToContent } from './Overlay';

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
  inTauri: boolean;
  variant: 'loading' | 'signin';
  /** Apply a pasted launch link / token — dev only (see DevConnect below). */
  onConnect?: (input: string) => void;
}

export function ConnectScreen({ inTauri, variant, onConnect }: ConnectScreenProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  useFitWindowToContent(shellRef, inTauri);

  return (
    <div className="overlay-shell" data-tauri-drag-region ref={shellRef}>
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
function DevConnect({ onConnect }: { onConnect: (input: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="ob-field" style={{ marginTop: 6 }}>
      <span className="ob-field-label">Dev · paste launch link or token</span>
      <input
        className="ob-input"
        placeholder="pitchgenius://… or a one-time token"
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) onConnect(value.trim());
        }}
      />
      <button
        type="button"
        className="ob-cta ob-cta--inline"
        style={{ marginTop: 8, alignSelf: 'flex-start' }}
        disabled={!value.trim()}
        onClick={() => onConnect(value.trim())}
      >
        Connect
      </button>
    </div>
  );
}
