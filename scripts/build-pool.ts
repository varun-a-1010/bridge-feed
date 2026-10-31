import { writeFileSync } from 'node:fs';
import { loadCorpus } from '../server/corpus';
import { QLOO_ORIGIN } from '../server/qloo';
import { ENTITY_TYPES, type EntityType } from '../shared/model';

/** Qloo ranks at most 50 candidates at once, so leave room for entities from new posts. */
const MAX_RECORDED = 42;
const corpus = loadCorpus();
const shown = new Set(corpus.posts.flatMap((p) => p.entities.map((e) => e.id)));
const interests = corpus.interests;
const groups = Array.from({ length: 4 }, (_, g) =>
  interests
    .filter((_, i) => i % 4 === g)
    .slice(0, 8)
    .map((i) => i.id),
);
const pool: Partial<Record<EntityType, string[]>> = {};
for (const type of ENTITY_TYPES) {
  const found = new Map<string, string>();
  for (const signal of groups) {
    const url = new URL('/v2/insights', QLOO_ORIGIN);
    url.search = new URLSearchParams({
      'filter.type': `urn:entity:${type}`,
      'signal.interests.entities': signal.join(','),
      take: '20',
    }).toString();
    const response = await fetch(url, { headers: { 'X-Api-Key': process.env.QLOO_API_KEY! } });
    const body = (await response.json()) as {
      results?: { entities?: { entity_id: string; name: string }[] };
    };
    for (const e of body.results?.entities ?? [])
      if (!shown.has(e.entity_id.toUpperCase())) found.set(e.entity_id.toUpperCase(), e.name);
  }
  const named = new Set(
    corpus.posts.flatMap((p) => p.entities.filter((e) => e.type === type).map((e) => e.id)),
  );
  pool[type] = [...found.keys()].slice(0, Math.min(30, MAX_RECORDED - named.size));
  console.log(
    type.padEnd(12),
    pool[type].length,
    [...found.values()].slice(0, 9).join(', ').slice(0, 130),
  );
}
writeFileSync('data/pool.json', JSON.stringify(pool) + '\n');
