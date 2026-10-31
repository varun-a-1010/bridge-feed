import type { GenerateContentResponse } from '@google/genai';
import { describe, expect, it, vi } from 'vitest';
import { MODEL_CHAINS, withFallback } from '../server/models';
import { withBackup } from '../server/vertex';

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

describe('backup project', () => {
  const answer = {} as GenerateContentResponse;
  const failure = Object.assign(new Error('quota'), { status: 429 });

  it('sends the same request to the backup when the primary fails', async () => {
    const primary = vi.fn(async () => {
      throw failure;
    });
    const backup = vi.fn(async () => answer);
    const request = { model: 'gemini-4-argon', contents: 'hello' };
    await expect(withBackup(primary, backup)(request)).resolves.toBe(answer);
    expect(backup).toHaveBeenCalledWith(request);
  });

  it('never calls the backup when the primary answers', async () => {
    const backup = vi.fn(async () => answer);
    await withBackup(async () => answer, backup)({ model: 'm', contents: 'hello' });
    expect(backup).not.toHaveBeenCalled();
  });

  it('leaves a call that timed out to the next model', async () => {
    const backup = vi.fn(async () => answer);
    const fail = async () => {
      throw failure;
    };
    const config = { abortSignal: AbortSignal.abort() };
    await expect(withBackup(fail, backup)({ model: 'm', contents: 'hello', config })).rejects.toBe(
      failure,
    );
    expect(backup).not.toHaveBeenCalled();
  });
});
