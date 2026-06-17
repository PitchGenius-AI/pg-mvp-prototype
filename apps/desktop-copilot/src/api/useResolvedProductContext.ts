import { useEffect, useRef, useState } from 'react';
import { copilotData, toSellerProduct } from './copilot-data';
import { productActions, useOnboardingComplete } from '../mock/store';

// Product-context resolution for the desktop first-run gate (M33 / PG-293).
//
// The desktop no longer assumes its product/ICP context is local-only. Once the
// rep is authenticated, we ask the backend (`workspace.getCurrent`) whether the
// account already has product context — captured in the web 11-step onboarding.
// If it does, the desktop adopts it (hydrates the shared store, source of truth)
// and skips first-run capture entirely. If it doesn't, we fall back to the
// desktop OnboardingFlow as the first-use capture, exactly as before.
//
//   account has products → 'done'   (hydrated, lands straight in the app)
//   account empty        → 'onboarding' (capture once; persists locally after)
//
// Resolution is best-effort: if the backend is unreachable we degrade to the
// local store (cached context or first-run capture), never blocking the app on a
// network round-trip — the same resilience posture as the ScriptedPlanner fallback.

export type ProductContextPhase = 'resolving' | 'onboarding' | 'done';

export function useResolvedProductContext(enabled: boolean): ProductContextPhase {
  // Local capture/skip flag. `hydrateFromBackend` also flips this true, so once a
  // resolution lands (from either side) this is the single signal the gate reads.
  const onboardingComplete = useOnboardingComplete();
  const [backendResolved, setBackendResolved] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    // Re-arm when auth drops (sign-out → sign-in) so the next session re-resolves.
    if (!enabled) {
      startedRef.current = false;
      setBackendResolved(false);
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const ctx = await copilotData.resolveProductContext();
        if (!cancelled && ctx && ctx.products.length > 0) {
          productActions.hydrateFromBackend(ctx.products.map(toSellerProduct));
        }
      } catch {
        // Backend unreachable — fall back to whatever the local store holds
        // (cached context, or first-run onboarding if empty). Don't block.
      } finally {
        if (!cancelled) setBackendResolved(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // A returning seller already carrying local context lands immediately; we don't
  // hold the app on the background resolve (it still runs and refreshes products).
  if (onboardingComplete) return 'done';
  // No local context yet: wait for the backend answer before deciding, so a
  // web-onboarded account is hydrated rather than wrongly sent to capture.
  if (!backendResolved) return 'resolving';
  return 'onboarding';
}
