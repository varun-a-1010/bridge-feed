import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  TOPICS,
  TYPE_LABELS,
  tierFor,
  type Entity,
  type EntityType,
  type Post,
  type PostEntity,
  type Profile,
  type RankRow,
  type Topic,
} from '../shared/model';
import type { Linker } from './links';
import { MODEL_CHAINS, thinkingFor, withFallback } from './models';
import type { Qloo } from './qloo';
import type { Generate } from './vertex';

/** Qloo's neighbours for one interest. Only the top of the list is ever used. */
const NEIGHBOURS = 25;
const TOP_NEIGHBOURS = 5;
const MAX_INTERESTS = 4;
const MAX_ACROSS = 9;
const MAX_NEAR = 3;
const MAX_CACHED = 200;

/** Fictional bylines. Generated posts are always labelled as written by Gemini. */
const AUTHORS = [
  'Noor K.',
  'Eli M.',
  'Tess R.',
  'Omar B.',
  'Lena V.',
  'Sam W.',
  'Maya D.',
  'Jo P.',
];

const NEIGHBOUR_TYPES: Record<EntityType, EntityType[]> = {
  artist: ['artist', 'movie', 'tv_show'],
  book: ['book', 'movie', 'tv_show'],
  brand: ['brand', 'movie', 'tv_show'],
  movie: ['movie', 'tv_show', 'book'],
  tv_show: ['tv_show', 'movie', 'book'],
  videogame: ['videogame', 'movie', 'tv_show'],
};

const system = `You write short social media posts for a clearly labelled simulation inside a research prototype. Each post comes from a fictional ordinary person.

You get a list of works and a list of stances, each with a topic. Write a post for at least two thirds of the works. Only leave a work out if every topic would read as absurd.

For each work, pick the topic where the connection feels most natural, and connect them in one of two honest ways:
1. The work's subject really does touch the opinion. A film about a rigged system fits a stance on luck. A show about surveillance fits privacy. Kitchens, farms and hunting fit a stance on meat. Anything made by artists fits a stance on AI in creative work.
2. The person simply mentions it as part of who they are, then says what they think, the way people do online: "Big Luke Combs fan, and I will say it: ..." or "Rewatching Bluey with my kids. Unrelated, but ...". The work does not have to cause the opinion. Do not pretend it did.

Never claim that a work teaches or proves something it does not. Avoid the phrases "reminds me" and "makes me think". Use each topic at most twice for each side.

Works with side "across" must argue that topic's "across" stance. Works with side "near" must argue its "near" stance.

Each post is 1 to 3 sentences, at most 260 characters, in the first person. It must sound like a real person talking, not an ad or an essay. Say the opinion in your own words. Never copy the stance sentence.
- Name the work exactly as written in "name".
- A reader must be able to tell which side the post is on.
- Stay with what is widely known about the work. Do not cite specific scenes, lyrics, dates or facts you are unsure of.
- No hashtags, no emoji, no insults, nothing hateful, and nothing about what any real person believes.
- Never address or mention the reader.

"voice_examples" are real posts from this platform. Match their length, plainness and rhythm. Never copy their wording or the works they mention.`;

const written = z.object({
  posts: z.array(
    z.object({ id: z.number().int(), topic: z.string(), text: z.string().min(1).max(600) }),
  ),
});
const writtenSchema = {
  type: 'object',
  properties: {
    posts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          topic: { type: 'string' },
          text: { type: 'string' },
        },
        required: ['id', 'topic', 'text'],
      },
    },
  },
  required: ['posts'],
};

type Candidate = { entity: PostEntity; side: 'across' | 'near'; ranks: RankRow[] };

/** "Dune: Part Two (2024)" reads as "Dune: Part Two", the way a person would write it. */
export const surfaceOf = (name: string) => name.replace(/\s*\(.*\)\s*$/, '').trim() || name;

const topicsFor = (profile: Profile) =>
  TOPICS.filter((topic) => profile.scores[topic.id] !== undefined).sort(
    (a, b) => Math.abs(profile.scores[b.id]! - 50) - Math.abs(profile.scores[a.id]! - 50),
  );

/** The far side of the scale from the reader, always a clear disagreement. */
export function acrossFrom(score: number) {
  const position = score < 50 ? Math.min(100, score + 60) : Math.max(0, score - 60);
  return Math.round(position / 10) * 10;
}

/** Close to the reader, for the posts that make their own feed feel like theirs. */
export const nearTo = (score: number, step: number) =>
  Math.max(0, Math.min(100, Math.round(score / 10) * 10 + (step % 2 ? 10 : -10) * (step % 3)));

export function createPostWriter(options: {
  generate?: Generate;
  qloo: Qloo;
  linker: Linker;
  isCommon: (entityId: string) => boolean;
  /** Curated posts, so generated ones sound like the same people on the same platform. */
  examples: Post[];
  sleep?: (ms: number) => Promise<void>;
}) {
  const cache = new Map<string, Post[]>();
  const exampleFor = (topic: Topic, position: number) =>
    options.examples
      .filter((post) => post.topic === topic && post.position !== null)
      .sort((a, b) => Math.abs(a.position! - position) - Math.abs(b.position! - position))[0]?.text;

  async function neighbours(interest: Entity, profile: Profile) {
    const held = new Set(profile.interests.map((i) => i.id));
    const lists = await Promise.all(
      NEIGHBOUR_TYPES[interest.type].map(async (type) => {
        const hits = await options.qloo.near(interest, type, NEIGHBOURS).catch(() => []);
        return hits.slice(0, TOP_NEIGHBOURS).flatMap((hit, index) =>
          held.has(hit.id) || options.isCommon(hit.id)
            ? []
            : [
                {
                  entity: hit,
                  row: {
                    interestId: interest.id,
                    type,
                    entityId: hit.id,
                    rank: index + 1,
                    of: Math.max(hits.length, NEIGHBOURS),
                  } satisfies RankRow,
                },
              ],
        );
      }),
    );
    return lists.flat();
  }

  async function plan(profile: Profile, focus: Entity[]) {
    if (!topicsFor(profile).length) return [];
    const found = (await Promise.all(focus.map((i) => neighbours(i, profile)))).flat();
    const approved = await options.linker.approve(
      found.map((f) => f.row),
      found.map((f) => f.entity),
      focus,
    );
    const across: Candidate[] = [];
    const used = new Set<string>();
    // Take turns across interests, so every one of them gets a chance.
    for (let round = 0; round < 3 && across.length < MAX_ACROSS; round++)
      for (const interest of focus) {
        const row = approved
          .filter((r) => r.interestId === interest.id && !used.has(r.entityId))
          .sort((a, b) => a.rank - b.rank)[0];
        const hit = row && found.find((f) => f.entity.id === row.entityId)?.entity;
        if (!row || !hit || across.length >= MAX_ACROSS) continue;
        used.add(row.entityId);
        across.push({
          entity: { ...hit, surface: surfaceOf(hit.name) },
          side: 'across',
          ranks: approved.filter((r) => r.entityId === row.entityId),
        });
      }
    const near = focus.slice(0, MAX_NEAR).map((interest): Candidate => ({
      entity: { ...interest, surface: surfaceOf(interest.name) },
      side: 'near',
      ranks: [],
    }));
    return [...across, ...near];
  }

  async function compose(candidates: Candidate[], profile: Profile) {
    const generate = options.generate;
    if (!generate || !candidates.length) return [];
    const topics = topicsFor(profile);
    const positions = new Map(
      topics.map((topic, index) => {
        const score = profile.scores[topic.id]!;
        return [topic.id, { across: acrossFrom(score), near: nearTo(score, index) }];
      }),
    );
    const { value } = await withFallback(
      MODEL_CHAINS.routine,
      async (model, timeoutMs) => {
        const response = await generate({
          model,
          contents: JSON.stringify({
            voice_examples: topics.flatMap((topic) => {
              const at = positions.get(topic.id)!;
              return [exampleFor(topic.id, at.across), exampleFor(topic.id, at.near)].filter(
                Boolean,
              );
            }),
            stances: topics.map((topic) => {
              const at = positions.get(topic.id)!;
              return {
                topic: topic.id,
                across: tierFor(topic.id, at.across),
                near: tierFor(topic.id, at.near),
              };
            }),
            works: candidates.map((c, id) => ({
              id,
              name: c.entity.surface,
              kind: TYPE_LABELS[c.entity.type].one,
              side: c.side,
            })),
          }),
          config: {
            systemInstruction: system,
            maxOutputTokens: 3000,
            ...thinkingFor(model),
            responseMimeType: 'application/json',
            responseJsonSchema: writtenSchema,
            abortSignal: AbortSignal.timeout(timeoutMs),
          },
        });
        return written.parse(JSON.parse(response.text ?? ''));
      },
      { sleep: options.sleep, timeoutMs: 15_000, passes: 2, deadlineMs: 25_000 },
    );
    const now = Date.now();
    return value.posts.flatMap((post, index): Post[] => {
      const candidate = candidates[post.id];
      const at = positions.get(post.topic as Topic);
      const text = post.text.trim();
      if (!candidate || !at || !text.toLowerCase().includes(candidate.entity.surface.toLowerCase()))
        return [];
      return [
        {
          id: `gen-${randomUUID()}`,
          source: 'generated',
          author: AUTHORS[index % AUTHORS.length]!,
          text: text.slice(0, 600),
          createdAt: new Date(now - (index + 1) * 2_700_000).toISOString(),
          topic: post.topic as Topic,
          position: at[candidate.side],
          confidence: 1,
          language: 'en',
          entities: [candidate.entity],
          unresolved: [],
          safety: 'publish',
          ...(candidate.ranks.length ? { ranks: candidate.ranks } : {}),
        },
      ];
    });
  }

  return {
    /** Fills the gap the curated posts leave. Anything that fails simply adds nothing. */
    async write(profile: Profile, uncovered: string[]) {
      const focus = profile.interests
        .filter((i) => uncovered.includes(i.id))
        .slice(0, MAX_INTERESTS);
      const key = JSON.stringify([focus.map((i) => i.id).sort(), profile.scores]);
      const cached = cache.get(key);
      if (cached) return cached;
      const posts = await compose(await plan(profile, focus), profile);
      if (posts.length) {
        if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
        cache.set(key, posts);
      }
      return posts;
    },
  };
}

export type PostWriter = ReturnType<typeof createPostWriter>;
