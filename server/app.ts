import { resolve } from 'node:path';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { z } from 'zod';
import { feedRequestSchema, fillRequestSchema, type Hero } from '../shared/model';
import { AgentUnavailable, type Agent } from './agent';
import type { Corpus } from './corpus';
import type { PostWriter } from './dynamic';
import { computeFeed } from './feed';
import type { Linker } from './links';
import { QlooError, type Qloo } from './qloo';

export type AppOptions = {
  qloo: Qloo;
  agent: Agent;
  corpus: Corpus;
  linker?: Linker;
  origin?: string;
  production?: boolean;
  staticRoot?: string;
  dailyRuns?: number;
  writer?: PostWriter;
  concurrentRuns?: number;
};

/** Each fill is a few model calls, so generated posts have a daily ceiling too. */
const MAX_DAILY_FILLS = 300;
const FILL_TIMEOUT_MS = 30_000;
const searchQuery = z.object({ q: z.string().trim().min(2).max(80) });
const analyzeBody = z.object({ text: z.string().trim().min(12).max(500) });

export async function buildApp(options: AppOptions) {
  const { qloo, agent, corpus, linker } = options;
  if (options.production && !options.origin)
    throw new Error('APP_ORIGIN is required in production.');
  const app = Fastify({ logger: false, bodyLimit: 65_536, trustProxy: '127.0.0.1' });
  await app.register(rateLimit, { max: 240, timeWindow: '1 minute' });

  let active = 0;
  let day = '';
  let runsToday = 0;
  let fillDay = '';
  let fillsToday = 0;
  const dailyRuns = options.dailyRuns ?? 400;
  const concurrentRuns = options.concurrentRuns ?? 4;

  app.addHook('onRequest', async (request, reply) => {
    reply.headers({
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      'content-security-policy':
        "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://images.qloo.com; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
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
    if (error instanceof QlooError) return reply.code(error.status).send({ error: error.message });
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

  let hero: Hero | null | undefined;
  const findHero = async () => {
    if (hero !== undefined) return hero;
    const reader = corpus.presets.find((p) => p.id === 'ines') ?? corpus.presets[0];
    hero = null;
    if (reader) {
      const feed = await computeFeed(qloo, corpus, reader, [], linker);
      const evidence = feed.bridge.find((item) => item.evidence)?.evidence;
      if (evidence)
        hero = {
          interest: evidence.interest,
          entity: evidence.entity,
          rank: evidence.rank,
          of: evidence.of,
          ...(evidence.reason ? { reason: evidence.reason } : {}),
        };
    }
    return hero;
  };

  app.get('/api/bootstrap', async () => ({
    hero: await findHero(),
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
      const { q } = searchQuery.parse(request.query);
      const found = await qloo.searchAll(q);
      return {
        results: found.slice(0, 8).map(({ id, name, type, image, year }) => ({
          id,
          name,
          type,
          ...(image ? { image } : {}),
          ...(year ? { year } : {}),
        })),
      };
    },
  );

  app.post(
    '/api/feed',
    { config: { rateLimit: { max: 40, timeWindow: '1 minute' } } },
    async (request) => {
      const { profile, posts } = feedRequestSchema.parse(request.body);
      return computeFeed(qloo, corpus, profile, posts, linker);
    },
  );

  app.post(
    '/api/fill',
    { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } },
    async (request) => {
      const { profile, uncovered } = fillRequestSchema.parse(request.body);
      const today = new Date().toISOString().slice(0, 10);
      if (today !== fillDay) {
        fillDay = today;
        fillsToday = 0;
      }
      if (!options.writer || fillsToday >= MAX_DAILY_FILLS) return { posts: [] };
      fillsToday++;
      // A fill is extra. If it is slow or fails, the reader keeps the feed they already have.
      const timeout = new Promise<[]>((done) => setTimeout(() => done([]), FILL_TIMEOUT_MS));
      const posts = await Promise.race([
        options.writer.write(profile, uncovered).catch((error) => {
          request.log.warn({ error: String(error) }, 'Generated posts failed');
          return [];
        }),
        timeout,
      ]);
      return { posts };
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
