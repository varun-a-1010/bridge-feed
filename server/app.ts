import { resolve } from 'node:path';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { ENTITY_TYPES, feedRequestSchema } from '../shared/model';
import { AgentUnavailable, type Agent } from './agent';
import type { Corpus } from './corpus';
import { computeFeed } from './feed';
import { QlooError, type Qloo } from './qloo';

export type AppOptions = {
  qloo: Qloo;
  agent: Agent;
  corpus: Corpus;
  origin?: string;
  production?: boolean;
  staticRoot?: string;
  dailyRuns?: number;
  concurrentRuns?: number;
};

const searchQuery = z.object({
  q: z.string().trim().min(2).max(80),
  type: z.enum(ENTITY_TYPES),
});
const analyzeBody = z.object({ text: z.string().trim().min(12).max(500) });

export async function buildApp(options: AppOptions) {
  const { qloo, agent, corpus } = options;
  if (options.production && !options.origin)
    throw new Error('APP_ORIGIN is required in production.');
  const app = Fastify({ logger: false, bodyLimit: 65_536, trustProxy: '127.0.0.1' });
  await app.register(rateLimit, { max: 240, timeWindow: '1 minute' });

  let active = 0;
  let day = '';
  let runsToday = 0;
  const dailyRuns = options.dailyRuns ?? 400;
  const concurrentRuns = options.concurrentRuns ?? 4;

  app.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy':
        "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    });
    if (request.method === 'POST') {
      const allowed = options.origin ?? `${request.protocol}://${request.headers.host}`;
      if (request.headers.origin !== allowed)
        return reply.code(403).send({ error: 'Cross-origin requests are not allowed.' });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof z.ZodError)
      return reply.code(400).send({ error: 'That request is not valid.' });
    if (error instanceof QlooError)
      return reply.code(error.status).send({ error: error.message });
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status < 500) return reply.code(status).send({ error: (error as Error).message });
    console.error('Unhandled error:', String(error).slice(0, 300));
    return reply.code(500).send({ error: 'Something went wrong. Try again.' });
  });

  app.get('/api/health', async () => ({
    ok: true,
    qloo: qloo.status,
    agent: agent.status,
    posts: corpus.posts.length,
    recordedRanks: corpus.recorded.size,
  }));

  app.get('/api/bootstrap', async () => ({
    interests: corpus.interests,
    presets: corpus.presets,
    posts: corpus.posts.length,
    entities: [...corpus.idsByType.values()].reduce((n, ids) => n + ids.length, 0),
    connected: { qloo: qloo.status === 'configured', agent: agent.status === 'configured' },
  }));

  app.get(
    '/api/search',
    { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } },
    async (request) => {
      const { q, type } = searchQuery.parse(request.query);
      return {
        results: (await qloo.search(q, type)).map(({ id, name, type }) => ({ id, name, type })),
      };
    },
  );

  app.post(
    '/api/feed',
    { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } },
    async (request) => {
      const { profile, posts } = feedRequestSchema.parse(request.body);
      return computeFeed(qloo, corpus, profile, posts);
    },
  );

  app.post(
    '/api/analyze',
    { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { text } = analyzeBody.parse(request.body);
      const today = new Date().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        runsToday = 0;
      }
      if (runsToday >= dailyRuns)
        return reply.code(429).send({ error: 'Today’s demo budget is used. Try again tomorrow.' });
      if (active >= concurrentRuns)
        return reply.code(503).send({ error: 'The agent is busy. Try again in a moment.' });
      active++;
      runsToday++;
      reply.hijack();
      reply.raw.writeHead(200, {
        'content-type': 'application/x-ndjson; charset=utf-8',
        'cache-control': 'no-store',
        'x-accel-buffering': 'no',
      });
      const send = (value: unknown) => reply.raw.write(`${JSON.stringify(value)}\n`);
      try {
        const result = await agent.run(text, { onStep: (step) => send({ type: 'step', step }) });
        send({ type: 'result', result });
      } catch (error) {
        send({
          type: 'error',
          message:
            error instanceof AgentUnavailable
              ? error.message
              : 'The analysis agent could not finish. Try again.',
        });
      } finally {
        active--;
        reply.raw.end();
      }
    },
  );

  if (options.staticRoot) {
    await app.register(fastifyStatic, { root: resolve(options.staticRoot), wildcard: false });
    app.setNotFoundHandler((request, reply) =>
      request.url.startsWith('/api/')
        ? reply.code(404).send({ error: 'Not found.' })
        : reply.sendFile('index.html'),
    );
  }
  return app;
}
