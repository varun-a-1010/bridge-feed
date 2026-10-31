import { describe, expect, it, vi } from 'vitest';
import { QLOO_ORIGIN, createQloo, rankKey } from '../server/qloo';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const interest = { id: A.toUpperCase(), name: 'Radiohead', type: 'artist' as const };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ranking = (rows: [string, number][]) =>
  json({
    success: true,
    results: {
      entities: rows.map(([entity_id, affinity]) => ({ entity_id, query: { affinity } })),
    },
  });

describe('qloo adapter', () => {
  it('sends only opaque entity IDs, to the hackathon host, with the key in a header', async () => {
    const fetchMock = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
      ranking([[B, 0.9]]),
    );
    const qloo = createQloo({ apiKey: 'secret', fetch: fetchMock as typeof fetch });
    await qloo.rank(interest, 'movie', [B, C]);
    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe(QLOO_ORIGIN);
    expect(parsed.search).not.toContain('secret');
    expect((init?.headers as Record<string, string>)['X-Api-Key']).toBe('secret');
    expect([...parsed.searchParams.keys()].sort()).toEqual([
      'filter.results.entities',
      'filter.type',
      'signal.interests.entities',
      'take',
    ]);
    expect(parsed.searchParams.get('signal.interests.entities')).toBe(interest.id);
    expect(parsed.search.toLowerCase()).not.toMatch(/score|position|privacy|speech/);
  });

  it('ranks by affinity, keeps ties equal and never invents an omitted candidate', async () => {
    const qloo = createQloo({
      apiKey: 'k',
      fetch: (async () =>
        ranking([
          [B, 0.5],
          [C, 0.9],
        ])) as typeof fetch,
    });
    const D = '44444444-4444-4444-8444-444444444444';
    const { rows, receipt } = await qloo.rank(interest, 'movie', [B, C, D]);
    expect(rows.map((r) => [r.entityId, r.rank, r.of])).toEqual([
      [C.toUpperCase(), 1, 2],
      [B.toUpperCase(), 2, 2],
    ]);
    expect(receipt).toMatchObject({ candidates: 3, returned: 2, source: 'live' });
  });

  it('leaves the interest out of its own candidates', async () => {
    const fetchMock = vi.fn(async () => ranking([[B, 0.5]]));
    const qloo = createQloo({ apiKey: 'k', fetch: fetchMock as typeof fetch });
    await qloo.rank(interest, 'artist', [A, B, C]);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('filter.results.entities')).not.toContain(interest.id);
  });

  it('retries a rate limit, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(ranking([[B, 0.5]]));
    const qloo = createQloo({ apiKey: 'k', fetch: fetchMock as typeof fetch });
    expect((await qloo.rank(interest, 'movie', [B, C])).rows).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves a recorded answer without calling Qloo, even with no key', async () => {
    const fetchMock = vi.fn();
    const recorded = new Map([
      [
        rankKey(interest.id, 'movie', [B.toUpperCase(), C.toUpperCase()]),
        {
          rows: [],
          receipt: {
            interest: 'Radiohead',
            type: 'movie' as const,
            candidates: 2,
            returned: 0,
            source: 'recorded' as const,
            retrievedAt: 'then',
          },
        },
      ],
    ]);
    const qloo = createQloo({ fetch: fetchMock as typeof fetch, recorded });
    expect((await qloo.rank(interest, 'movie', [B, C])).receipt.source).toBe('recorded');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a Qloo image and drops one from any other host', async () => {
    const qloo = createQloo({
      apiKey: 'k',
      fetch: (async () =>
        json({
          success: true,
          results: [
            {
              entity_id: B,
              name: 'Hosted',
              types: ['urn:entity:movie'],
              properties: { image: { url: 'https://images.qloo.com/i/a.jpg' } },
            },
            {
              entity_id: C,
              name: 'Elsewhere',
              types: ['urn:entity:movie'],
              properties: { image: { url: 'https://evil.test/a.jpg' } },
            },
          ],
        })) as typeof fetch,
    });
    const hits = await qloo.search('x', 'movie');
    expect(hits[0]?.image).toBe('https://images.qloo.com/i/a.jpg');
    expect(hits[1]?.image).toBeUndefined();
  });

  it('rejects a search hit of the wrong type and reports a missing key', async () => {
    const qloo = createQloo({
      apiKey: 'k',
      fetch: (async () =>
        json({
          success: true,
          results: [
            { entity_id: B, name: 'Right', types: ['urn:entity:movie'] },
            { entity_id: C, name: 'Wrong', types: ['urn:entity:book'] },
          ],
        })) as typeof fetch,
    });
    expect((await qloo.search('x', 'movie')).map((h) => h.name)).toEqual(['Right']);
    await expect(createQloo().search('x', 'movie')).rejects.toThrow('not connected');
  });
});
