import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../server/app';
import type { Agent } from '../server/agent';
import { AgentUnavailable } from '../server/agent';
import type { Corpus } from '../server/corpus';
import type { Qloo } from '../server/qloo';
import type { AgentResult } from '../shared/model';

const ORIGIN = 'https://bridge.test';
const headers = { origin: ORIGIN, 'content-type': 'application/json' };
const corpus: Corpus = {
  posts: [],
  interests: [],
  presets: [],
  recorded: new Map(),
  pool: {},
  idsByType: new Map(),
  commonness: new Map(),
};
const qloo: Qloo = {
  status: 'configured',
  search: vi.fn(async () => []),
  rank: vi.fn(),
};
const result = { status: 'topic_only', reach: [], note: '', turns: 1 } as unknown as AgentResult;
const agentWith = (run: Agent['run']): Agent => ({ status: 'configured', run });
const setup = (agent: Agent = agentWith(async () => result), extra = {}) =>
  buildApp({ qloo, agent, corpus, origin: ORIGIN, ...extra });
const body = JSON.stringify({ text: 'A long enough post to analyze.' });

describe('api', () => {
  it('reports health without leaking configuration', async () => {
    const app = await setup();
    const health = await app.inject({ url: '/api/health' });
    expect(health.json()).toMatchObject({ ok: true, qloo: 'configured', agent: 'configured' });
  });

  it('refuses cross-origin writes and requires an origin in production', async () => {
    const app = await setup();
    const denied = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      headers: { ...headers, origin: 'https://evil.test' },
      payload: body,
    });
    expect(denied.statusCode).toBe(403);
    await expect(
      buildApp({ qloo, agent: agentWith(async () => result), corpus, production: true }),
    ).rejects.toThrow('APP_ORIGIN');
  });

  it('rejects invalid feed requests', async () => {
    const app = await setup();
    const bad = await app.inject({
      method: 'POST',
      url: '/api/feed',
      headers,
      payload: JSON.stringify({ profile: { scores: {}, interests: [] } }),
    });
    expect(bad.statusCode).toBe(400);
  });

  it('rejects a score outside the scale', async () => {
    const app = await setup();
    const bad = await app.inject({
      method: 'POST',
      url: '/api/feed',
      headers,
      payload: JSON.stringify({
        profile: {
          scores: { privacy: 140 },
          interests: [{ id: '11111111-1111-4111-8111-111111111111', name: 'A', type: 'artist' }],
        },
      }),
    });
    expect(bad.statusCode).toBe(400);
  });

  it('leaves out an entity that ranks high for nearly everyone', async () => {
    const entity = '22222222-2222-4222-8222-222222222222';
    const interest = {
      id: '11111111-1111-4111-8111-111111111111'.toUpperCase(),
      name: 'A',
      type: 'artist' as const,
    };
    const shared = {
      ...corpus,
      commonness: new Map([[entity.toUpperCase(), 0.9]]),
      posts: [
        {
          id: 'p',
          source: 'seed' as const,
          author: 'S',
          text: 'Text',
          createdAt: 'now',
          topic: 'privacy' as const,
          position: 10,
          confidence: 0.9,
          language: 'en',
          entities: [
            { id: entity.toUpperCase(), name: 'Common', type: 'brand' as const, surface: 'Text' },
          ],
          unresolved: [],
          safety: 'publish' as const,
        },
      ],
    };
    const ranking: Qloo = {
      ...qloo,
      rank: vi.fn(async () => ({
        rows: [
          {
            interestId: interest.id,
            type: 'brand' as const,
            entityId: entity.toUpperCase(),
            rank: 1,
            of: 40,
          },
        ],
        receipt: {
          interest: 'A',
          type: 'brand' as const,
          candidates: 40,
          returned: 40,
          source: 'live' as const,
          retrievedAt: 'now',
        },
      })),
    };
    const { computeFeed } = await import('../server/feed');
    const feed = await computeFeed(
      ranking,
      shared,
      { scores: { privacy: 90 }, interests: [interest] },
      [],
    );
    expect(feed.stats).toMatchObject({ opposing: 1, shown: 0 });
  });

  it('streams agent steps and the result as lines', async () => {
    const app = await setup(
      agentWith(async (_text, run) => {
        run?.onStep?.({ id: 1, kind: 'read', title: 'Read', provenance: 'Gemini' });
        return result;
      }),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      headers,
      payload: body,
    });
    const lines = response.body
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines.map((l) => l.type)).toEqual(['step', 'result']);
    expect(response.headers['x-accel-buffering']).toBe('no');
  });

  it('sends a plain error when the agent cannot finish', async () => {
    const app = await setup(
      agentWith(async () => {
        throw new AgentUnavailable('Try again.');
      }),
    );
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      headers,
      payload: body,
    });
    expect(JSON.parse(response.body.trim())).toEqual({ type: 'error', message: 'Try again.' });
  });

  it('stops at the daily budget, which bounds what a public URL can spend', async () => {
    const app = await setup(undefined, { dailyRuns: 1 });
    const post = () => app.inject({ method: 'POST', url: '/api/analyze', headers, payload: body });
    expect((await post()).statusCode).toBe(200);
    expect((await post()).statusCode).toBe(429);
  });

  it('limits each forwarded client separately behind the local proxy', async () => {
    const app = await setup(undefined, { dailyRuns: 100 });
    const post = (client: string) =>
      app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers: { ...headers, 'x-forwarded-for': client },
        payload: body,
      });
    for (let i = 0; i < 6; i++) expect((await post('203.0.113.1')).statusCode).toBe(200);
    expect((await post('203.0.113.1')).statusCode).toBe(429);
    expect((await post('203.0.113.2')).statusCode).toBe(200);
  });

  it('rejects text that is too short or too long', async () => {
    const app = await setup();
    for (const text of ['short', 'x'.repeat(501)]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/analyze',
        headers,
        payload: JSON.stringify({ text }),
      });
      expect(response.statusCode).toBe(400);
    }
  });
});
