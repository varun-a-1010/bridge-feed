import { describe, expect, it } from 'vitest';
import { MODEL_CHAINS, withFallback } from '../server/models';

const rateLimited = () => Promise.reject(new Error('429 Resource exhausted'));
const noWait = async () => {};

describe('model fallback', () => {
  it('leads critical work with Argon and keeps a route around every model', () => {
    expect(MODEL_CHAINS.critical[0]).toBe('gemini-4-argon');
    expect(MODEL_CHAINS.routine).not.toContain('gemini-4-argon');
    expect(MODEL_CHAINS.routine.length).toBeGreaterThanOrEqual(3);
  });

  it('moves to the next model on a rate limit', async () => {
    const tried: string[] = [];
    const out = await withFallback(
      ['a', 'b', 'c'],
      (model) => {
        tried.push(model);
        return model === 'b' ? Promise.resolve('ok') : rateLimited();
      },
      { sleep: noWait },
    );
    expect(out).toEqual({ value: 'ok', model: 'b' });
    expect(tried).toEqual(['a', 'b']);
  });

  it('survives every model being rate limited at once by backing off and retrying', async () => {
    let calls = 0;
    const waits: number[] = [];
    const out = await withFallback(
      ['a', 'b'],
      () => (++calls > 5 ? Promise.resolve('recovered') : rateLimited()),
      { sleep: noWait, onBackoff: (ms) => waits.push(ms) },
    );
    expect(out.value).toBe('recovered');
    expect(waits.length).toBe(2);
    expect(waits[1]!).toBeGreaterThan(waits[0]!);
  });

  it('tries a recently failed model last, and only fails after every pass', async () => {
    const failed = new Set(['a']);
    const order: string[] = [];
    await withFallback(['a', 'b'], async (model) => (order.push(model), model), { failed });
    expect(order).toEqual(['b']);
    await expect(withFallback(['a'], rateLimited, { sleep: noWait, passes: 3 })).rejects.toThrow(
      '429',
    );
  });

  it('stops at the deadline instead of hanging', async () => {
    await expect(
      withFallback(['a'], rateLimited, { sleep: noWait, deadlineMs: 0 }),
    ).rejects.toThrow();
  });

  it('gives a model no more time than the deadline leaves', async () => {
    let given = 0;
    await withFallback(['gemini-4-argon'], async (_m, timeout) => (given = timeout), {
      deadlineMs: 5_000,
    });
    expect(given).toBeLessThanOrEqual(5_000);
  });
});
