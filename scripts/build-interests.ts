import { writeFileSync } from 'node:fs';
import { createQloo } from '../server/qloo';
import type { CatalogItem } from '../shared/model';
import { CATALOG } from './seed-data';

const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY });
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const interests: CatalogItem[] = [];
for (const item of CATALOG) {
  const hits = await qloo.search(item.name, item.type);
  const wanted = fold(item.expect ?? item.name);
  const hit = hits.find((h) => fold(h.name) === wanted) ?? hits[0];
  if (!hit) {
    console.log(`UNRESOLVED ${item.name}`);
    continue;
  }
  if (fold(hit.name) !== wanted) console.log(`CHECK ${item.name} -> ${hit.name}`);
  interests.push({
    id: hit.id,
    name: hit.name,
    type: hit.type,
    ...(item.sports ? { group: 'sports' as const } : {}),
  });
}
writeFileSync('data/interests.json', JSON.stringify(interests, null, 1) + '\n');
console.log(`Resolved ${interests.length} of ${CATALOG.length} interests.`);
