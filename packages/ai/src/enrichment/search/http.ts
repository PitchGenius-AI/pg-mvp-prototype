// Shared HTTP helpers for search providers. Providers throw on failure; the
// fan-out (index.ts) converts a final throw into an ok=false ProviderResult so one
// provider's loss never sinks the stage.

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

// A failure is worth retrying if it's a network/abort error, a 429, or a 5xx.
// 4xx (bad key, bad request) is terminal — retrying just wastes the budget.
export function isTransientError(err: unknown): boolean {
  if (err instanceof ProviderHttpError) {
    if (err.status === null) return true; // network-level
    return err.status === 429 || err.status >= 500;
  }
  // fetch network errors / AbortError surface as plain Errors/TypeErrors.
  return true;
}

// fetch + JSON with abort wiring. Throws ProviderHttpError on non-2xx.
export async function fetchJson(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal });
  } catch (err) {
    // Network failure or abort — transient, no status.
    throw new ProviderHttpError(err instanceof Error ? err.message : 'network error', null);
  }
  if (!res.ok) {
    throw new ProviderHttpError(`HTTP ${res.status}`, res.status);
  }
  return res.json();
}

// Defensive string coercion for untrusted, variably-shaped provider JSON.
export function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
