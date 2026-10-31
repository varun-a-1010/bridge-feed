import { describe, expect, it, vi } from 'vitest';
import type { GenerateContentResponse } from '@google/genai';
import { createLinker, linkKey } from '../server/links';
import type { Entity, RankRow } from '../shared/model';

const interest: Entity = { id: 'I', name: 'Boardwalk Empire', type: 'tv_show' };
const good: Entity = { id: 'G', name: 'Rounders', type: 'movie' };
const bad: Entity = { id: 'B', name: 'Adobe', type: 'brand' };
const row = (entityId: string, rank = 1, of = 40): RankRow => ({
  interestId: 'I',
  type: 'movie',
  entityId,
  rank,
  of,
});
const answer = (verdicts: unknown[]) =>
  ({ text: JSON.stringify({ verdicts }) }) as unknown as GenerateContentResponse;
const noWait = async () => {};

describe('link check', () => {
  it('keeps what a person would accept, with the reason, and drops the rest', async () => {
    const generate = vi.fn(async () =>
      answer([
        { id: 0, ok: true, reason: 'Both explore crime and risk.' },
        { id: 1, ok: false, reason: '' },
      ]),
    );
    const linker = createLinker({ generate, sleep: noWait });
    const kept = await linker.approve([row('G'), row('B', 2)], [good, bad], [interest]);
    expect(kept.map((r) => r.entityId)).toEqual(['G']);
    expect(linker.reason('I', 'G')).toBe('Both explore crime and risk.');
  });

  it('fails closed, so a link it could not check never appears', async () => {
    const generate = vi.fn(async () => {
      throw new Error('429');
    });
    const linker = createLinker({ generate, sleep: noWait });
    expect(await linker.approve([row('G')], [good], [interest])).toEqual([]);
    expect(linker.unchecked([row('G')])).toBe(1);
  });

  it('can only remove: a model verdict for a pair nobody proposed is ignored', async () => {
    const generate = vi.fn(async () => answer([{ id: 7, ok: true, reason: 'Invented.' }]));
    const linker = createLinker({ generate, sleep: noWait });
    await linker.approve([row('G')], [good], [interest]);
    expect(linker.entries()).toEqual([]);
  });

  it('does not approve a link with no stated reason', async () => {
    const generate = vi.fn(async () => answer([{ id: 0, ok: true, reason: '  ' }]));
    const linker = createLinker({ generate, sleep: noWait });
    expect(await linker.approve([row('G')], [good], [interest])).toEqual([]);
  });

  it('uses a reviewed link without calling the model', async () => {
    const generate = vi.fn();
    const linker = createLinker({
      generate,
      links: new Map([[linkKey('I', 'G'), { ok: true, reason: 'Crime and risk.' }]]),
    });
    expect(await linker.approve([row('G')], [good], [interest])).toHaveLength(1);
    expect(generate).not.toHaveBeenCalled();
  });

  it('stops reviewing at the daily ceiling and resumes the next day', async () => {
    const generate = vi.fn(async () => answer([{ id: 0, ok: true, reason: 'Crime and risk.' }]));
    let date = new Date('2026-10-30T12:00:00Z');
    const linker = createLinker({ generate, sleep: noWait, dailyPairs: 1, now: () => date });
    expect(await linker.approve([row('G')], [good], [interest])).toHaveLength(1);
    expect(await linker.approve([row('B', 2)], [bad], [interest])).toEqual([]);
    expect(generate).toHaveBeenCalledTimes(1);
    date = new Date('2026-10-31T12:00:00Z');
    expect(await linker.approve([row('B', 2)], [bad], [interest])).toHaveLength(1);
  });

  it('ignores a rank outside the cutoff entirely', async () => {
    const generate = vi.fn();
    const linker = createLinker({ generate });
    expect(await linker.approve([row('G', 30)], [good], [interest])).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });
});
