import { writeFileSync } from 'node:fs';
import { loadCorpus } from '../server/corpus';
import { createQloo, rankKey } from '../server/qloo';
import type { EntityType } from '../shared/model';

const corpus = loadCorpus();
const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY });
const jobs = corpus.interests.flatMap((interest) =>
  [...corpus.idsByType.keys()].map((type) => ({ interest, type })),
);
const answers: unknown[] = [];
let failed = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (;;) {
      const job = jobs.shift();
      if (!job) return;
      const { interest, type } = job as { interest: (typeof corpus.interests)[number]; type: EntityType };
      const ids = [...new Set(corpus.idsByType.get(type) ?? [])].filter((id) => id !== interest.id);
      try {
        const { rows } = await qloo.rank(interest, type, ids);
        answers.push({
          key: rankKey(interest.id, type, ids),
          interest: interest.name,
          interestId: interest.id,
          type,
          candidates: ids.length,
          rows: rows.map((r) => [r.entityId, r.rank]),
        });
      } catch (error) {
        failed++;
        console.log(`failed ${interest.name} / ${type}: ${String(error).slice(0, 80)}`);
      }
    }
  }),
);
writeFileSync(
  'data/ranks.json',
  JSON.stringify({ retrievedAt: new Date().toISOString(), answers }) + '\n',
);
console.log(`Recorded ${answers.length} rankings, ${failed} failed.`);
