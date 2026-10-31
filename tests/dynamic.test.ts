import { describe, expect, it, vi } from 'vitest';
import type { GenerateContentResponse } from '@google/genai';
import { acrossFrom, createPostWriter, nearTo, surfaceOf } from '../server/dynamic';
import { createLinker, linkKey } from '../server/links';
import type { Qloo, SearchHit } from '../server/qloo';
import type { Entity, Profile } from '../shared/model';
import { MIN_GAP } from '../shared/feed';

const interest: Entity = { id: 'BLUEY', name: 'Bluey', type: 'tv_show' };
const profile: Profile = { scores: { success: 20 }, interests: [interest] };
const near: SearchHit = { id: 'PARASITE', name: 'Parasite (2019)', type: 'movie', description: '' };
const answer = (posts: unknown[]) =>
  ({ text: JSON.stringify({ posts }) }) as unknown as GenerateContentResponse;
const qloo = (hits: SearchHit[] = [near]) =>
  ({ near: vi.fn(async () => hits), tags: vi.fn(async () => []) }) as unknown as Qloo;
const links = new Map([[linkKey('BLUEY', 'PARASITE'), { ok: true, reason: 'Family.' }]]);
const writer = (
  generate: (request: { contents: unknown }) => Promise<GenerateContentResponse>,
  source = qloo(),
) =>
  createPostWriter({
    generate,
    qloo: source,
    linker: createLinker({ links }),
    isCommon: () => false,
    examples: [],
    sleep: async () => {},
  });

describe('generated posts', () => {
  it('always places an across post clearly away from the reader', () => {
    for (let score = 0; score <= 100; score += 10)
      expect(Math.abs(acrossFrom(score) - score)).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it('keeps a near post on the reader’s side of the gap', () => {
    for (let score = 0; score <= 100; score += 10)
      for (let step = 0; step < 3; step++)
        expect(Math.abs(nearTo(score, step) - score)).toBeLessThan(MIN_GAP);
  });

  it('writes a labelled post that carries Qloo’s real ranking', async () => {
    const generate = vi.fn(async () =>
      answer([{ id: 0, topic: 'success', text: 'Parasite shows where you start decides it.' }]),
    );
    const [post] = await writer(generate).write(profile, ['BLUEY']);
    expect(post).toMatchObject({ source: 'generated', topic: 'success', position: 80 });
    expect(post?.ranks?.[0]).toMatchObject({ interestId: 'BLUEY', entityId: 'PARASITE', rank: 1 });
  });

  it('drops a post that never names its work or picks an unknown topic', async () => {
    const generate = vi.fn(async () =>
      answer([
        { id: 0, topic: 'success', text: 'Luck decides most of it.' },
        { id: 0, topic: 'privacy', text: 'Parasite and privacy.' },
      ]),
    );
    const posts = await writer(generate).write(profile, ['BLUEY']);
    expect(posts.filter((p) => p.ranks)).toEqual([]);
  });

  it('never proposes an interest the reader already holds as the bridge', async () => {
    let works: { side: string }[] = [];
    const generate = vi.fn(async (request: { contents: unknown }) => {
      works = JSON.parse(String(request.contents)).works;
      return answer([]);
    });
    await writer(generate, qloo([{ ...interest, description: '' }])).write(profile, ['BLUEY']);
    expect(works.filter((w) => w.side === 'across')).toEqual([]);
  });

  it('adds nothing when the model fails', async () => {
    const generate = vi.fn(async () => {
      throw new Error('429');
    });
    await expect(writer(generate).write(profile, ['BLUEY'])).rejects.toThrow();
  });

  it('removes a trailing year from a title', () => {
    expect(surfaceOf('Parasite (2019)')).toBe('Parasite');
  });
});
