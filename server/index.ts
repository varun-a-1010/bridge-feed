import { resolve } from 'node:path';
import { createAgent } from './agent';
import { createPostWriter } from './dynamic';
import { buildApp } from './app';
import { loadCorpus } from './corpus';
import { MAX_COMMONNESS } from './feed';
import { createLinker } from './links';
import { createQloo } from './qloo';
import { createGenerate } from './vertex';

const production = process.env.NODE_ENV === 'production';
const corpus = loadCorpus();
const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY, recorded: corpus.recorded });
const generate = createGenerate({
  project: process.env.VERTEX_LLM_PROJECT_ID,
  serviceAccount: process.env.VERTEX_LLM_SERVICE_ACCOUNT,
  location: process.env.VERTEX_LLM_REGION,
  backup: {
    project: process.env.VERTEX_LLM_BACKUP_PROJECT_ID,
    serviceAccount: process.env.VERTEX_LLM_BACKUP_SERVICE_ACCOUNT,
  },
});
const linker = createLinker({ generate, qloo, tags: corpus.tags, links: corpus.links });
const agent = createAgent({
  generate,
  qloo,
  linker,
  audiences: corpus.presets,
  catalog: corpus.interests,
  corpus: (type) => corpus.idsByType.get(type) ?? [],
  isCommon: (id) => (corpus.commonness.get(id) ?? 0) > MAX_COMMONNESS,
});
const writer = createPostWriter({
  generate,
  qloo,
  linker,
  examples: corpus.posts,
  isCommon: (id) => (corpus.commonness.get(id) ?? 0) > MAX_COMMONNESS,
});
const app = await buildApp({
  qloo,
  agent,
  writer,
  corpus,
  linker,
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
