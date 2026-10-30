import { resolve } from 'node:path';
import { createAgent } from './agent';
import { buildApp } from './app';
import { loadCorpus } from './corpus';
import { createQloo } from './qloo';

const production = process.env.NODE_ENV === 'production';
const corpus = loadCorpus();
const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY, recorded: corpus.recorded });
const agent = createAgent({
  project: process.env.VERTEX_LLM_PROJECT_ID,
  serviceAccount: process.env.VERTEX_LLM_SERVICE_ACCOUNT,
  location: process.env.VERTEX_LLM_REGION,
  qloo,
  audiences: corpus.presets,
  corpus: (type) => corpus.idsByType.get(type) ?? [],
});
const app = await buildApp({
  qloo,
  agent,
  corpus,
  origin: process.env.APP_ORIGIN,
  production,
  staticRoot: production ? resolve('dist/client') : undefined,
});
const port = Number(process.env.PORT ?? 3194);
await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
console.info(`Bridge Feed API listening on port ${port}.`);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
