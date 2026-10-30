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
      payload: JSON.stringify({ profile: { stances: {}, interests: [] } }),
    });
    expect(bad.statusCode).toBe(400);
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
