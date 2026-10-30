import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  entitySchema,
  postSchema,
  type CatalogItem,
  type EntityType,
  type Post,
  type Preset,
  type Profile,
} from '../shared/model';
import { bridgeCutoff } from '../shared/feed';
import type { RankAnswer } from './qloo';

export type Corpus = {
  posts: Post[];
  interests: CatalogItem[];
  presets: Preset[];
  recorded: Map<string, RankAnswer>;
  /** Qloo entities of each type that post entities are ranked against. */
  pool: Partial<Record<EntityType, string[]>>;
  idsByType: Map<EntityType, string[]>;
  /** Share of tested interests that rank an entity inside the bridge cutoff. */
  commonness: Map<string, number>;
};

const presetFile = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    blurb: z.string(),
    scores: z.record(z.string(), z.number()),
    interests: z.array(z.string()).min(1).max(6),
  }),
);

type RankFile = {
  retrievedAt: string;
  answers: {
    key: string;
    interest: string;
    interestId: string;
    type: EntityType;
    candidates: number;
    of: number;
    rows: [string, number][];
  }[];
};

export const indexEntities = (posts: Post[], pool: Partial<Record<EntityType, string[]>> = {}) => {
  const byType = new Map<EntityType, Set<string>>(
    Object.entries(pool).map(([type, ids]) => [type as EntityType, new Set(ids)]),
  );
  for (const post of posts)
    for (const entity of post.entities) {
      if (!byType.has(entity.type)) byType.set(entity.type, new Set());
      byType.get(entity.type)!.add(entity.id);
    }
  return new Map([...byType].map(([type, ids]) => [type, [...ids]]));
};

export function loadCorpus(directory = 'data'): Corpus {
  const read = <T>(name: string, fallback: T): T => {
    const path = join(directory, name);
    return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback;
  };
  const posts = z.array(postSchema).parse(read('posts.json', []));
  const interests = z
    .array(entitySchema.extend({ group: z.literal('sports').optional() }))
    .parse(read('interests.json', []));
  const presets = presetFile.parse(read('presets.json', [])).map((preset) => ({
    ...preset,
    scores: preset.scores as Profile['scores'],
    interests: preset.interests.map((name) => {
      const interest = interests.find((i) => i.name === name);
      if (!interest) throw new Error(`Preset interest is not in the catalog: ${name}`);
      return interest;
    }),
  }));
  const ranks = read<RankFile>('ranks.json', { retrievedAt: '', answers: [] });
  const recorded = new Map<string, RankAnswer>(
    ranks.answers.map((answer) => [
      answer.key,
      {
        rows: answer.rows.map(([entityId, rank]) => ({
          interestId: answer.interestId,
          type: answer.type,
          entityId,
          rank,
          of: answer.of,
        })),
        receipt: {
          interest: answer.interest,
          type: answer.type,
          candidates: answer.candidates,
          returned: answer.of,
          source: 'recorded',
          retrievedAt: ranks.retrievedAt,
        },
      },
    ]),
  );
  const pool = read<Corpus['pool']>('pool.json', {});
  const hits = new Map<string, number>();
  for (const { rows } of recorded.values())
    for (const row of rows)
      if (row.rank <= bridgeCutoff(row.of))
        hits.set(row.entityId, (hits.get(row.entityId) ?? 0) + 1);
  const commonness = new Map(
    [...hits].map(([id, count]) => [id, count / Math.max(1, interests.length - 1)]),
  );
  return {
    posts,
    interests,
    presets,
    recorded,
    pool,
    idsByType: indexEntities(posts, pool),
    commonness,
  };
}
