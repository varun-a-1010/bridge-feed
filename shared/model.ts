import { z } from 'zod';

export const ENTITY_TYPES = [
  'artist',
  'book',
  'brand',
  'destination',
  'movie',
  'tv_show',
  'videogame',
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const TYPE_LABELS: Record<EntityType, { one: string; many: string }> = {
  artist: { one: 'Artist', many: 'artists' },
  book: { one: 'Book', many: 'books' },
  brand: { one: 'Brand', many: 'brands' },
  destination: { one: 'Destination', many: 'destinations' },
  movie: { one: 'Film', many: 'films' },
  tv_show: { one: 'TV show', many: 'TV shows' },
  videogame: { one: 'Game', many: 'games' },
};

export const TOPICS = [
  {
    id: 'ai_creativity',
    label: 'AI in creative work',
    stances: [
      { id: 'ai_skeptical', label: 'Mostly skeptical' },
      { id: 'ai_supportive', label: 'Mostly supportive' },
    ],
  },
  {
    id: 'eating_meat',
    label: 'Eating meat',
    stances: [
      { id: 'meat_positive', label: 'I eat meat' },
      { id: 'plant_based', label: 'Mostly plant-based' },
    ],
  },
  {
    id: 'remote_work',
    label: 'Remote work',
    stances: [
      { id: 'remote_first', label: 'Prefer remote' },
      { id: 'office_first', label: 'Prefer in-person' },
    ],
  },
  {
    id: 'transport',
    label: 'Getting around',
    stances: [
      { id: 'pro_driving', label: 'Prefer driving' },
      { id: 'pro_transit', label: 'Prefer public transit' },
    ],
  },
  {
    id: 'fashion',
    label: 'What we wear',
    stances: [
      { id: 'affordable_fashion', label: 'Affordability first' },
      { id: 'sustainable_fashion', label: 'Sustainability first' },
    ],
  },
  {
    id: 'smart_tech',
    label: 'Smart tech at home',
    stances: [
      { id: 'smart_convenience', label: 'Worth the convenience' },
      { id: 'privacy_first', label: 'Privacy comes first' },
    ],
  },
] as const;

export type Topic = (typeof TOPICS)[number]['id'];
export type Stance = (typeof TOPICS)[number]['stances'][number]['id'];
export type StanceChoice = Stance | 'mixed';
export const TOPIC_IDS = TOPICS.map((t) => t.id) as [Topic, ...Topic[]];
export const STANCE_IDS = TOPICS.flatMap((t) => t.stances.map((s) => s.id)) as [
  Stance,
  ...Stance[],
];

export const topicOf = (id: string) => TOPICS.find((t) => t.id === id);
export const stanceLabel = (id: string) =>
  TOPICS.flatMap((t) => [...t.stances]).find((s) => s.id === id)?.label ?? 'Mixed';
export const opposingStance = (stance: Stance): Stance => {
  const topic = TOPICS.find((t) => t.stances.some((s) => s.id === stance))!;
  return topic.stances.find((s) => s.id !== stance)!.id;
};

const entityId = z
  .string()
  .uuid()
  .transform((id) => id.toUpperCase());

export const entitySchema = z.object({
  id: entityId,
  name: z.string().min(1).max(200),
  type: z.enum(ENTITY_TYPES),
});
export type Entity = z.infer<typeof entitySchema>;

export const postEntitySchema = entitySchema.extend({ surface: z.string().min(1).max(200) });
export type PostEntity = z.infer<typeof postEntitySchema>;

export const postSchema = z.object({
  id: z.string().min(1).max(80),
  source: z.enum(['seed', 'user', 'peer']),
  author: z.string().min(1).max(60),
  text: z.string().min(1).max(600),
  createdAt: z.string().max(40),
  topic: z.enum(TOPIC_IDS).nullable(),
  viewpoint: z.union([z.enum(STANCE_IDS), z.literal('mixed')]).nullable(),
  confidence: z.number().min(0).max(1),
  language: z.string().min(2).max(20),
  entities: z.array(postEntitySchema).max(8),
  unresolved: z.array(z.object({ text: z.string().max(200), reason: z.string().max(300) })).max(8),
  safety: z.enum(['publish', 'review', 'reject']),
});
export type Post = z.infer<typeof postSchema>;

export const profileSchema = z.object({
  stances: z.partialRecord(z.enum(TOPIC_IDS), z.union([z.enum(STANCE_IDS), z.literal('mixed')])),
  interests: z.array(entitySchema).min(1).max(6),
});
export type Profile = z.infer<typeof profileSchema>;

export const feedRequestSchema = z.object({
  profile: profileSchema,
  posts: z.array(postSchema).max(8).default([]),
});

export type Preset = Profile & { id: string; name: string; blurb: string };

/** One Qloo answer: this entity's position among the candidates, for one interest alone. */
export type RankRow = {
  interestId: string;
  type: EntityType;
  entityId: string;
  rank: number;
  of: number;
};

export type Receipt = {
  interest: string;
  type: EntityType;
  candidates: number;
  returned: number;
  source: 'recorded' | 'live';
  retrievedAt: string;
};

export type Evidence = {
  entity: PostEntity;
  interest: Entity;
  rank: number;
  of: number;
  /** Other selected interests that also rank this entity inside the bridge cutoff. */
  alsoSupportedBy: { interest: string; rank: number }[];
};

export type FeedItem = {
  post: Post;
  kind: 'aligned' | 'mixed' | 'bridge' | 'mine';
  evidence?: Evidence;
  /** Selected interests literally named in the post. Never enough to bridge on its own. */
  literal: string[];
};

export type FeedStats = {
  posts: number;
  opposing: number;
  qualified: number;
  shown: number;
  qlooOnly: number;
  noEvidence: number;
};

export type FeedResponse = {
  typical: FeedItem[];
  bridge: FeedItem[];
  stats: FeedStats;
  receipts: Receipt[];
};

export type ReachResult = {
  audience: string;
  audienceId: string;
  stance: string;
  outcome: 'bridge' | 'no_evidence' | 'same_side';
  evidence?: { entity: string; interest: string; rank: number; of: number };
};

export type AgentStep = {
  id: number;
  kind: 'read' | 'search' | 'link' | 'drop' | 'reach' | 'finish' | 'hold' | 'error';
  title: string;
  detail?: string;
  provenance: 'Gemini' | 'Qloo' | 'Bridge Feed';
  model?: string;
};

export type AgentResult = {
  post: Post;
  reach: ReachResult[];
  status: 'bridge_ready' | 'topic_only' | 'held';
  note: string;
  turns: number;
};
