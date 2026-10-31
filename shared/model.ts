import { z } from 'zod';

export const ENTITY_TYPES = ['artist', 'book', 'brand', 'movie', 'tv_show', 'videogame'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const TYPE_LABELS: Record<EntityType, { one: string; many: string }> = {
  artist: { one: 'Artist', many: 'artists' },
  book: { one: 'Book', many: 'books' },
  brand: { one: 'Brand', many: 'brands' },
  movie: { one: 'Film', many: 'films' },
  tv_show: { one: 'TV show', many: 'TV shows' },
  videogame: { one: 'Game', many: 'games' },
};

/** Each topic is an 11-stop scale. Every stop is a statement a person would have to endorse. */
export const TOPICS = [
  {
    id: 'ai_art',
    label: 'AI in creative work',
    low: 'Keep it out',
    high: 'Embrace it',
    tiers: [
      'AI-made art should be banned from anything sold commercially.',
      'Studios and labels should not be allowed to use generative AI at all.',
      'Artists can experiment privately, but AI stays out of anything released.',
      'Fine for rough ideas and mock-ups, never in the finished work.',
      'Fine as a small tool, if it is credited and the artists it trained on are paid.',
      'It depends on the project. I judge the result case by case.',
      'AI is a normal creative tool now, as long as its use is disclosed.',
      'It does not need a label. If the work is good, it is good.',
      'Training on public work is fair, the way artists learn from each other.',
      'Studios can replace whole roles with AI if audiences are happy.',
      'AI should make most art. Human-only work will become a niche craft.',
    ],
  },
  {
    id: 'animal_welfare',
    label: 'Animal welfare',
    low: 'Meat is fine',
    high: 'Go vegan',
    tiers: [
      'Meat is natural. There is no ethical question here.',
      'I eat what I like, though I would avoid needless cruelty.',
      'Meat is fine, but I try to buy from farms that treat animals well.',
      'Meat is fine a few times a week. Most of us just eat too much.',
      'I should eat less meat, and I am trying to.',
      'Meat is morally gray. I eat it and I am not comfortable about it.',
      'Mostly vegetarian is the right way to live, with meat as an exception.',
      'Eating meat is wrong when alternatives exist. Eggs and dairy are fine.',
      'Factory farming is a moral catastrophe, so I avoid meat entirely.',
      'Vegan is the ethical default. Dairy and eggs cause harm too.',
      'Using animals for food is wrong and should eventually be illegal.',
    ],
  },
  {
    id: 'free_speech',
    label: 'Free speech',
    low: 'No limits',
    high: 'Strict limits',
    tiers: [
      'All speech should be legal, including speech most people find vile.',
      'Only direct threats and fraud should be restricted.',
      'Platforms should remove what is illegal and nothing else.',
      'Offense is the price of freedom, but targeted harassment can come down.',
      'Platforms can set rules, but should almost always leave things up.',
      'Some limits are needed. I decide case by case.',
      'Platforms should remove hate speech, even when it is legal.',
      'Platforms should also limit false claims that can hurt people.',
      'Hate speech should be illegal, not just banned by platforms.',
      'Speech that demeans any group should carry legal penalties.',
      'Governments should actively decide what is safe to publish.',
    ],
  },
  {
    id: 'privacy',
    label: 'Privacy',
    low: 'Share it',
    high: 'Keep it private',
    tiers: [
      'I will share any data that makes life easier. I have nothing to hide.',
      'Cameras and microphones at home are worth the convenience.',
      'Companies can keep my data if they keep it secure.',
      'Personalized ads are a fair trade for free services.',
      'I accept tracking, but I want to see it and be able to opt out.',
      'Some sharing is fine. It depends who is asking and why.',
      'Tracking should be off unless I turn it on.',
      'I keep always-listening devices out of my home.',
      'Companies should be barred from selling personal data at all.',
      'I give up real convenience to use privacy tools everywhere.',
      'Nobody should collect personal data without a court-level reason.',
    ],
  },
  {
    id: 'success',
    label: 'Success',
    low: 'It is earned',
    high: 'It is luck',
    tiers: [
      'Anyone can make it. Success comes down to effort.',
      'Effort decides almost everything. Luck evens out over a life.',
      'Talent and hard work explain most success.',
      'Hard work matters most, though a good start helps.',
      'Effort and circumstance both matter, with effort slightly ahead.',
      'It is an even split between effort and luck.',
      'Where you start matters a bit more than how hard you try.',
      'Most successful people were lucky and rarely admit it.',
      'Family, money and connections explain most success.',
      'Hard work rarely beats where you were born.',
      'Success is almost all luck. Nobody really earns a fortune.',
    ],
  },
  {
    id: 'personal_freedom',
    label: 'Personal freedom',
    low: 'Let adults choose',
    high: 'Protect people',
    tiers: [
      'Adults can do anything to themselves. The state should stay out of it.',
      'Gambling, drugs and other vices should all be legal for adults.',
      'Legalize it all, with age limits and nothing else.',
      'Keep risky things legal, with warnings and no more.',
      'Keep them legal, but tax them and limit the advertising.',
      'It depends on the harm. I judge each one on its own.',
      'Ads for gambling, vaping and alcohol should be banned.',
      'Risky products should be hard to get, with strict limits.',
      'Sports betting apps and similar products should be banned.',
      'Society should ban most addictive products, even for adults.',
      'Governments should protect people from harmful choices, whatever they want.',
    ],
  },
] as const;

export type Topic = (typeof TOPICS)[number]['id'];
export const TOPIC_IDS = TOPICS.map((t) => t.id) as [Topic, ...Topic[]];
/** Tells apart entities that share a name, such as a show and the book it came from. */
export const describeEntity = (entity: { type: EntityType; year?: number }) =>
  entity.year ? `${TYPE_LABELS[entity.type].one}, ${entity.year}` : TYPE_LABELS[entity.type].one;

/** Which end of a scale a score sits nearer, in the scale's own neutral words. */
export const leanFor = (topic: string | null | undefined, score: number) => {
  const found = topicOf(topic);
  if (!found) return '';
  return score < 40 ? found.low : score > 60 ? found.high : 'In the middle';
};

export const STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export const topicOf = (id: string | null | undefined) => TOPICS.find((t) => t.id === id);
export const tierFor = (topic: string | null | undefined, score: number) =>
  topicOf(topic)?.tiers[Math.round(score / 10)] ?? '';

const entityId = z
  .string()
  .uuid()
  .transform((id) => id.toUpperCase());

const score = z.number().int().min(0).max(100);

const qlooImage = z
  .string()
  .max(300)
  .refine((url) => url.startsWith('https://images.qloo.com/'));

export const entitySchema = z.object({
  id: entityId,
  name: z.string().min(1).max(200),
  type: z.enum(ENTITY_TYPES),
  image: qlooImage.optional(),
  year: z.number().int().min(1000).max(3000).optional(),
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
  /** Where the text sits on the topic's scale, read by Gemini. Public, as an author's score. */
  position: score.nullable(),
  confidence: z.number().min(0).max(1),
  language: z.string().min(2).max(20),
  entities: z.array(postEntitySchema).max(8),
  unresolved: z.array(z.object({ text: z.string().max(200), reason: z.string().max(300) })).max(8),
  safety: z.enum(['publish', 'review', 'reject']),
});
export type Post = z.infer<typeof postSchema>;

export const profileSchema = z.object({
  scores: z.partialRecord(z.enum(TOPIC_IDS), score),
  interests: z.array(entitySchema).min(1).max(6),
});
export type Profile = z.infer<typeof profileSchema>;

export const feedRequestSchema = z.object({
  profile: profileSchema,
  posts: z.array(postSchema).max(8).default([]),
});

export type Preset = Profile & { id: string; name: string; blurb: string };

export type CatalogItem = Entity & { group?: 'sports' };

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
  /** Share of tested interests that place this entity inside the cutoff. Absent if untested. */
  commonness?: number;
  /** One plain line on what the two share, written by Gemini after checking the link makes sense. */
  reason?: string;
};

export type FeedItem = {
  post: Post;
  kind: 'aligned' | 'nearby' | 'bridge' | 'mine';
  /** Distance between the reader's score and the post's position on the topic. */
  gap?: number;
  evidence?: Evidence;
  /** Selected interests literally named in the post. Never enough to bridge on its own. */
  literal: string[];
};

/** A real bridge from the sample data, shown on the landing page. */
export type Hero = {
  interest: Entity;
  entity: PostEntity;
  rank: number;
  of: number;
  reason?: string;
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
  /** Links that could not be checked, so they were left out. */
  uncheckedLinks: number;
};

export type ReachResult = {
  audience: string;
  audienceId: string;
  score: number;
  outcome: 'bridge' | 'no_evidence' | 'same_side';
  /** A reader built from the catalog, for a post that no sample reader would connect to. */
  reader?: Preset;
  evidence?: { entity: string; interest: string; rank: number; of: number; reason?: string };
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
