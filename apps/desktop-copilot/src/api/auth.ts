import { invoke } from '@tauri-apps/api/core';
import { getCurrent as getCurrentDeepLinks, onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL, setBearerToken, trpc } from './client';

// Desktop ↔ web auth handoff (M33/PG-289).
//
// The web app mints a short-lived, single-use token (copilot.mintLaunchToken) and
// opens `pitchgenius://session/{opportunityId}?t={token}` (or `…/launch?t=…`). The
// desktop exchanges that token for a real session, stores the resulting bearer
// token in the OS keychain (so the rep stays signed in across launches), and sends
// it as `Authorization: Bearer …` on every tRPC call.

const KEYRING_ACCOUNT = 'session-token';

export interface ParsedLaunch {
  /** The single-use one-time token from the deeplink query, if present. */
  token: string | null;
  /** The opportunity to bind the call to (from `session/{id}`), else null (cold launch). */
  opportunityId: string | null;
}

/** Parse a `pitchgenius://` launch URL. Returns null for anything else. */
export function parseDeepLink(url: string): ParsedLaunch | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'pitchgenius:') return null;
  const token = parsed.searchParams.get('t');
  // host is `session` (bind to a deal) or `launch` (cold → picker, PG-291).
  const opportunityId =
    parsed.host === 'session' ? parsed.pathname.replace(/^\/+/, '') || null : null;
  return { token, opportunityId };
}

// Exchange the single-use deeplink token for a session. The bearer token comes
// back in the `set-auth-token` response header (Better Auth bearer plugin); we
// fall back to the body's session.token if a proxy strips the header.
async function exchangeOneTimeToken(token: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/auth/one-time-token/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const headerToken = res.headers.get('set-auth-token');
  if (headerToken) return headerToken;
  try {
    const body = (await res.json()) as { session?: { token?: string } };
    return body.session?.token ?? null;
  } catch {
    return null;
  }
}

async function persistSession(token: string): Promise<void> {
  setBearerToken(token);
  try {
    await invoke('secret_set', { account: KEYRING_ACCOUNT, value: token });
  } catch {
    // Keychain unavailable — the session still works in-memory for this run.
  }
}

async function clearStoredSession(): Promise<void> {
  setBearerToken(null);
  try {
    await invoke('secret_delete', { account: KEYRING_ACCOUNT });
  } catch {
    // noop
  }
}

async function restoreStoredSession(): Promise<boolean> {
  try {
    const token = await invoke<string | null>('secret_get', { account: KEYRING_ACCOUNT });
    if (token) {
      setBearerToken(token);
      return true;
    }
  } catch {
    // keychain unavailable
  }
  return false;
}

// Confirm the active bearer token actually authenticates (PG-289 acceptance): one
// protected call. A resolved query — even `null` (signed in, onboarding incomplete)
// — means the token worked; a throw (UNAUTHORIZED) means it didn't.
async function verifySession(): Promise<boolean> {
  try {
    await trpc.workspace.getCurrent.query();
    return true;
  } catch {
    return false;
  }
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface CopilotAuth {
  status: AuthStatus;
  /** Opportunity id from a `session/{id}` deeplink, for the picker/binding (PG-291/292). */
  pendingOpportunityId: string | null;
  signOut: () => Promise<void>;
  /**
   * Apply a launch input — a full `pitchgenius://…` URL or a bare one-time token.
   * The OS deeplink path calls this internally; in dev it's also exposed to a manual
   * paste affordance, because macOS `tauri dev` can't register the URL scheme (no
   * bundle), so there's no OS routing during development.
   */
  connect: (input: string) => Promise<void>;
}

// Drives the desktop auth boot: restore a stored session, then accept a launch
// deeplink (initial + live), exchanging its token and persisting the session.
export function useCopilotAuth(): CopilotAuth {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null);
  const handledTokens = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  useEffect(() => () => void (mountedRef.current = false), []);

  const applyLaunch = useCallback(async (parsed: ParsedLaunch): Promise<void> => {
    if (parsed.opportunityId && mountedRef.current) setPendingOpportunityId(parsed.opportunityId);
    if (!parsed.token || handledTokens.current.has(parsed.token)) return;
    handledTokens.current.add(parsed.token);
    const bearer = await exchangeOneTimeToken(parsed.token);
    if (bearer) {
      await persistSession(bearer);
      if (mountedRef.current) setStatus('authenticated');
    }
  }, []);

  // Manual/dev entry point: accept a full pitchgenius:// URL or a bare token.
  const connect = useCallback(
    async (input: string): Promise<void> => {
      const trimmed = input.trim();
      const parsed: ParsedLaunch | null = trimmed.startsWith('pitchgenius://')
        ? parseDeepLink(trimmed)
        : { token: trimmed || null, opportunityId: null };
      if (parsed) await applyLaunch(parsed);
    },
    [applyLaunch],
  );

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    async function boot(): Promise<void> {
      // 1. A previously stored session (standalone menu-bar launch).
      if (await restoreStoredSession()) {
        if (await verifySession()) {
          if (!cancelled) setStatus('authenticated');
        } else {
          await clearStoredSession();
        }
      }

      // 2. A launch deeplink present at startup (web → desktop handoff).
      try {
        const initial = await getCurrentDeepLinks();
        for (const url of initial ?? []) {
          const parsed = parseDeepLink(url);
          if (parsed) await applyLaunch(parsed);
        }
      } catch {
        // deep-link plugin unavailable (e.g. browser demo) — ignore.
      }

      // 3. Deeplinks that arrive while already running.
      try {
        unlisten = await onOpenUrl((urls) => {
          for (const url of urls) {
            const parsed = parseDeepLink(url);
            if (parsed) void applyLaunch(parsed);
          }
        });
      } catch {
        // noop
      }

      // 4. Settle: anything still loading means no valid session yet.
      if (!cancelled) setStatus((s) => (s === 'authenticated' ? s : 'unauthenticated'));
    }

    void boot();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [applyLaunch]);

  return {
    status,
    pendingOpportunityId,
    connect,
    signOut: async () => {
      await clearStoredSession();
      setStatus('unauthenticated');
    },
  };
}
