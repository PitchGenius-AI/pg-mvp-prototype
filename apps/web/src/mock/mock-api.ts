// Simulated-network wrapper. Every "API" call in the prototype routes through this so
// loading states, latency, and error states match what tRPC + a real backend would feel like.
// The dev console hook (`window.__mockApi`) lets a demoer crank latency up to see skeletons
// or set errorRate=1 to exercise error paths without code changes.

export type DelayRange = readonly [number, number];

export interface MockApiOptions {
  /** Override the default delay window. */
  delayMs?: DelayRange;
  /** Mark this as a "slow AI" call — uses the AI default delay window. */
  slow?: boolean;
  /** Probability 0-1 of throwing a MockApiError instead of resolving. */
  errorRate?: number;
  /** Custom error message used when error injection fires. */
  errorMessage?: string;
}

export class MockApiError extends Error {
  constructor(message = 'Simulated mock API error') {
    super(message);
    this.name = 'MockApiError';
  }
}

interface MockApiGlobals {
  /** Multiplier applied on top of any per-call delay. 0 disables latency entirely. */
  latencyMultiplier: number;
  /** Global error-rate floor (0-1). Per-call errorRate is max()'d with this. */
  errorRate: number;
  /** When true, every call resolves immediately and never errors (useful for tests). */
  disable: boolean;
}

const globals: MockApiGlobals = {
  latencyMultiplier: 1,
  errorRate: 0,
  disable: false,
};

const DEFAULT_DELAY: DelayRange = [200, 800];
const AI_DELAY: DelayRange = [1500, 2500];

const randomInRange = ([min, max]: DelayRange) => min + Math.random() * (max - min);

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

export async function mockApi<T>(
  fn: () => T | Promise<T>,
  options: MockApiOptions = {},
): Promise<T> {
  if (globals.disable) return Promise.resolve().then(fn);

  const baseRange = options.delayMs ?? (options.slow ? AI_DELAY : DEFAULT_DELAY);
  const delay = randomInRange(baseRange) * globals.latencyMultiplier;
  if (delay > 0) await wait(delay);

  const effectiveErrorRate = Math.max(options.errorRate ?? 0, globals.errorRate);
  if (effectiveErrorRate > 0 && Math.random() < effectiveErrorRate) {
    throw new MockApiError(options.errorMessage);
  }

  return fn();
}

/** Convenience wrapper for prompt-chain style calls (parser, signal extraction, diagnosis). */
export const mockAiCall = <T>(fn: () => T | Promise<T>, options: Omit<MockApiOptions, 'slow'> = {}) =>
  mockApi(fn, { ...options, slow: true });

// Dev-only global hook so a demoer can tweak latency/error rate from the browser console:
//   window.__mockApi.setLatency(3)      // 3× normal latency
//   window.__mockApi.setErrorRate(0.5)  // 50% of calls fail
//   window.__mockApi.disable()          // bypass entirely (useful for testing)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __mockApi: unknown }).__mockApi = {
    setLatency(multiplier: number) {
      globals.latencyMultiplier = Math.max(0, multiplier);
    },
    setErrorRate(rate: number) {
      globals.errorRate = Math.min(1, Math.max(0, rate));
    },
    disable() {
      globals.disable = true;
    },
    enable() {
      globals.disable = false;
    },
    state() {
      return { ...globals };
    },
  };
}
