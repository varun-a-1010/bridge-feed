import { readFileSync, writeFileSync } from 'node:fs';
import { createQloo } from '../server/qloo';
import type { CatalogItem, EntityType, Post } from '../shared/model';

/** Adds Qloo's own image URLs to entities that are already confirmed. Identity never changes. */
const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY });
const posts = JSON.parse(readFileSync('data/posts.json', 'utf8')) as Post[];
const interests = JSON.parse(readFileSync('data/interests.json', 'utf8')) as CatalogItem[];

const found = new Map<string, string | undefined>();
async function imageFor(entity: { id: string; name: string; type: EntityType }) {
  if (found.has(entity.id)) return found.get(entity.id);
  const hits = await qloo.search(entity.name, entity.type);
  const image = hits.find((hit) => hit.id === entity.id)?.image;
  found.set(entity.id, image);
  return image;
}

for (const item of [...interests, ...posts.flatMap((p) => p.entities)]) {
  const image = await imageFor(item);
  if (image) item.image = image;
}
writeFileSync('data/interests.json', JSON.stringify(interests, null, 1) + '\n');
writeFileSync('data/posts.json', JSON.stringify(posts, null, 1) + '\n');
const hits = [...found.values()].filter(Boolean).length;
console.log(`Images for ${hits} of ${found.size} entities.`);
console.log('Without:', [...found].filter(([, v]) => !v).length);
