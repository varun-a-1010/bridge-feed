import { describe, expect, it } from 'vitest';
import { composeFeeds, bridgeCutoff, literalMatches, strongestEvidence } from '../shared/feed';
import type { Post, Profile, RankRow } from '../shared/model';

const RADIOHEAD = { id: 'A', name: 'Radiohead', type: 'artist' as const };
const profile: Profile = {
  stances: { smart_tech: 'privacy_first', ai_creativity: 'mixed', transport: 'pro_transit' },
  interests: [RADIOHEAD],
};
const post = (id: string, over: Partial<Post> = {}): Post => ({
  id,
  source: 'seed',
  author: 'Sample',
  text: `Post ${id}`,
  createdAt: '2026-10-30T00:00:00Z',
  topic: 'smart_tech',
  viewpoint: 'smart_convenience',
  confidence: 0.9,
  language: 'en',
  entities: [{ id: `E${id}`, name: `Entity ${id}`, type: 'movie', surface: `Post ${id}` }],
  unresolved: [],
  safety: 'publish',
  ...over,
});
const rank = (entityId: string, position = 1, of = 40): RankRow => ({
  interestId: 'A',
  type: 'movie',
  entityId,
  rank: position,
  of,
});

describe('bridge eligibility', () => {
  it('qualifies a differing post through a Qloo ranking with no shared word', () => {
    const feeds = composeFeeds([post('1')], profile, [rank('E1')]);
    expect(feeds.bridge.find((i) => i.kind === 'bridge')?.post.id).toBe('1');
    expect(feeds.stats).toMatchObject({ shown: 1, qlooOnly: 1, opposing: 1 });
  });

  it('never bridges on a literal match alone', () => {
    const literal = post('1', {
      text: 'I love Radiohead and smart homes.',
      entities: [{ ...RADIOHEAD, surface: 'Radiohead' }],
    });
    expect(literalMatches(literal, profile)).toEqual(['Radiohead']);
    const feeds = composeFeeds([literal], profile, [rank('A')]);
    expect(feeds.stats.shown).toBe(0);
    expect(feeds.bridge).toHaveLength(0);
  });

  it('counts a literal mention beside a real Qloo link, and reports it is not Qloo-only', () => {
    const both = post('1', { text: 'Post 1 and Radiohead together.' });
    const feeds = composeFeeds([both], profile, [rank('E1')]);
    expect(feeds.stats).toMatchObject({ shown: 1, qlooOnly: 0 });
  });

  it('manufactures nothing when Qloo returned no evidence', () => {
    const feeds = composeFeeds([post('1')], profile, []);
    expect(feeds.stats).toMatchObject({ shown: 0, noEvidence: 1 });
    expect(feeds.bridge.some((i) => i.kind === 'bridge')).toBe(false);
  });

  it('rejects a rank outside the cutoff and a pool too small to mean anything', () => {
    expect(bridgeCutoff(40)).toBe(4);
    expect(strongestEvidence(post('1'), profile, [rank('E1', 5, 40)])).toBeUndefined();
    expect(strongestEvidence(post('1'), profile, [rank('E1', 1, 4)])).toBeUndefined();
    expect(strongestEvidence(post('1'), profile, [rank('E1', 4, 40)])?.rank).toBe(4);
  });

  it('gates on viewpoint, confidence, safety and a held opinion', () => {
    const cases: Partial<Post>[] = [
      { viewpoint: 'privacy_first' },
      { viewpoint: 'mixed' },
      { confidence: 0.69 },
      { safety: 'review' },
      { safety: 'reject' },
      { topic: 'ai_creativity', viewpoint: 'ai_supportive' },
      { topic: 'eating_meat', viewpoint: 'plant_based' },
    ];
    for (const over of cases)
      expect(
        composeFeeds([post('1', over)], profile, [rank('E1')]).stats.shown,
        JSON.stringify(over),
      ).toBe(0);
  });

  it('prefers the rarer rank across different pool sizes', () => {
    const interest = { ...profile };
    const strong = post('1', {
      entities: [{ id: 'E1', name: 'One', type: 'movie', surface: 'Post 1' }],
    });
    const weak = post('2', {
      entities: [{ id: 'E2', name: 'Two', type: 'movie', surface: 'Post 2' }],
    });
    const feeds = composeFeeds([weak, strong], interest, [rank('E1', 1, 50), rank('E2', 1, 13)]);
    const bridges = feeds.bridge.filter((i) => i.kind === 'bridge').map((i) => i.post.id);
    expect(bridges).toEqual(['1', '2']);
  });
});

describe('feed composition', () => {
  const aligned = (id: string) => post(id, { viewpoint: 'privacy_first', entities: [] });

  it('keeps the same ordinary posts in both feeds and adds only bridges', () => {
    const posts = ['a', 'b', 'c'].map(aligned).concat(post('1'));
    const feeds = composeFeeds(posts, profile, [rank('E1')]);
    expect(feeds.bridge.filter((i) => i.kind !== 'bridge').map((i) => i.post.id)).toEqual(
      feeds.typical.map((i) => i.post.id),
    );
    expect(feeds.typical.some((i) => i.post.id === '1')).toBe(false);
  });

  it('spaces bridges no closer than one in four', () => {
    const posts = Array.from({ length: 12 }, (_, i) => aligned(`a${i}`)).concat(
      post('1'),
      post('2', { topic: 'transport', viewpoint: 'pro_driving' }),
      post('3', { topic: 'transport', viewpoint: 'pro_driving' }),
    );
    const feeds = composeFeeds(posts, profile, [rank('E1'), rank('E2'), rank('E3')]);
    const slots = feeds.bridge.flatMap((item, index) => (item.kind === 'bridge' ? [index] : []));
    expect(slots.length).toBe(3);
    slots.slice(1).forEach((slot, i) => expect(slot - slots[i]!).toBeGreaterThanOrEqual(4));
  });

  it('caps bridges per topic', () => {
    const posts = ['1', '2', '3'].map((id) => post(id));
    const feeds = composeFeeds(
      posts,
      profile,
      ['E1', 'E2', 'E3'].map((id) => rank(id)),
    );
    expect(feeds.stats).toMatchObject({ qualified: 3, shown: 2 });
  });

  it('pins your own post and leads with it when shown to a differing reader', () => {
    const mine = post('me', { source: 'user' });
    expect(composeFeeds([mine], profile, [rank('Eme')]).typical[0]).toMatchObject({ kind: 'mine' });
    const seen = composeFeeds([post('1'), post('me', { source: 'peer' })], profile, [
      rank('E1', 1),
      rank('Eme', 3),
    ]);
    expect(seen.bridge.filter((i) => i.kind === 'bridge')[0]?.post.id).toBe('me');
  });
});
