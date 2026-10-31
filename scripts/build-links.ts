import { writeFileSync } from 'node:fs';
import { loadCorpus } from '../server/corpus';
import { MAX_COMMONNESS } from '../server/feed';
import { createLinker, type LinkPair } from '../server/links';
import { createQloo } from '../server/qloo';
import { createGenerate } from '../server/vertex';
import { MIN_CANDIDATES, candidateCutoff } from '../shared/feed';

/** Reviews every link Qloo proposes between catalog interests and sample posts. */
const corpus = loadCorpus();
const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY });
const generate = createGenerate({
  project: process.env.VERTEX_LLM_PROJECT_ID,
  serviceAccount: process.env.VERTEX_LLM_SERVICE_ACCOUNT,
  location: process.env.VERTEX_LLM_REGION,
});
const entities = new Map(corpus.posts.flatMap((p) => p.entities.map((e) => [e.id, e] as const)));
const pairs: LinkPair[] = [];
for (const { rows } of corpus.recorded.values())
  for (const row of rows) {
    const entity = entities.get(row.entityId);
    const interest = corpus.interests.find((i) => i.id === row.interestId);
    if (
      entity &&
      interest &&
      entity.id !== interest.id &&
      row.of >= MIN_CANDIDATES &&
      row.rank <= candidateCutoff(row.of) &&
      (corpus.commonness.get(row.entityId) ?? 0) <= MAX_COMMONNESS
    )
      pairs.push({ interest, entity });
  }
const tags: Record<string, string[]> = {};
for (const id of new Set(pairs.flatMap((p) => [p.interest.id, p.entity.id])))
  tags[id] = await qloo.tags(id).catch(() => []);
const seeded = createLinker({
  generate,
  critical: true,
  tags: new Map(Object.entries(tags)),
  links: corpus.links,
});
for (let pass = 0; pass < 3; pass++)
  for (let start = 0; start < pairs.length; start += 40)
    await seeded.judge(pairs.slice(start, start + 40));
writeFileSync('data/tags.json', JSON.stringify(tags) + '\n');
writeFileSync('data/links.json', JSON.stringify(Object.fromEntries(seeded.entries())) + '\n');
const results = pairs.map((p) => seeded.get(p.interest.id, p.entity.id));
console.log(
  `${results.filter((r) => r?.ok).length} approved, ${results.filter((r) => r && !r.ok).length} rejected, ${results.filter((r) => !r).length} unchecked`,
);
