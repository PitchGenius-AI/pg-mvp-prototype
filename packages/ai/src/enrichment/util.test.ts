import { describe, expect, it, vi } from 'vitest';
import { mapWithConcurrency, withRetry } from './util';

describe('withRetry', () => {
  it('retries a transient failure then succeeds', async () => {
    const fn = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient failure', async () => {
    const fn = vi.fn<(attempt: number) => Promise<string>>().mockRejectedValue(new Error('fatal'));
    await expect(withRetry(fn, { baseDelayMs: 1, isTransient: () => false })).rejects.toThrow(
      'fatal',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the attempt budget', async () => {
    const fn = vi.fn<(attempt: number) => Promise<string>>().mockRejectedValue(new Error('x'));
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toThrow('x');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input order in the output', async () => {
    const out = await mapWithConcurrency([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it('never exceeds the concurrency cap', async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });
});
