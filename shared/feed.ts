import type { Evidence, FeedItem, FeedStats, Post, Profile, RankRow, Topic } from './model';

export const MIN_CONFIDENCE = 0.7;
export const MIN_CANDIDATES = 12;
/** Four stops apart on an 11-stop scale counts as a genuinely different view. */
export const MIN_GAP = 40;
export const MAX_BRIDGES = 5;
const MAX_PER_TOPIC = 2;
/** One bridge in every four slots, starting high enough to be seen. */
const BRIDGE_SLOTS = [1, 5, 9, 13, 17];
const FEED_LENGTH = 16;

/** Qloo affinities are normalized per query, so a bridge is gated on position, not raw score. */
export const bridgeCutoff = (of: number) => Math.max(3, Math.ceil(of * 0.1));
/** Qloo proposes generously, because a sense check decides what a reader finally sees. */
export const candidateCutoff = (of: number) => Math.max(5, Math.ceil(of * 0.2));

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function literalMatches(post: Post, profile: Profile) {
  const text = fold(post.text);
  const ids = new Set(post.entities.map((e) => e.id));
  return profile.interests
    .filter((i) => ids.has(i.id) || text.includes(fold(i.name)))
    .map((i) => i.name);
}

/**
 * The strongest Qloo connection between a post and the viewer's interests. A post only ever
 * earns this from Qloo's ranking of an entity the viewer did not select themselves.
 */
export function strongestEvidence(
  post: Post,
  profile: Profile,
  ranks: RankRow[],
): Evidence | undefined {
  const selected = new Set(profile.interests.map((i) => i.id));
  const held = ranks.filter((r) => selected.has(r.interestId));
  let best: Evidence | undefined;
  for (const entity of post.entities) {
    if (selected.has(entity.id)) continue;
    const rows = held
      .filter(
        (r) =>
          r.entityId === entity.id &&
          r.of >= MIN_CANDIDATES &&
          r.rank <= candidateCutoff(r.of) &&
          r.interestId !== entity.id,
      )
      .sort((a, b) => a.rank / a.of - b.rank / b.of || a.rank - b.rank);
    const top = rows[0];
    const interest = top && profile.interests.find((i) => i.id === top.interestId);
    if (!top || !interest) continue;
    const candidate: Evidence = {
      entity,
      interest,
      rank: top.rank,
      of: top.of,
      alsoSupportedBy: rows.slice(1, 3).flatMap((r) => {
        const name = profile.interests.find((i) => i.id === r.interestId)?.name;
        return name ? [{ interest: name, rank: r.rank }] : [];
      }),
    };
    if (!best || strength(candidate) > strength(best)) best = candidate;
  }
  return best;
}

const strength = (e: Evidence) => 1 - e.rank / e.of + e.alsoSupportedBy.length * 0.01;

export const gapBetween = (post: Post, profile: Profile) => {
  const score = post.topic ? profile.scores[post.topic as Topic] : undefined;
  return score === undefined || post.position === null
    ? undefined
    : Math.abs(score - post.position);
};

export function composeFeeds(posts: Post[], profile: Profile, ranks: RankRow[]) {
  const published = posts.filter((p) => p.safety === 'publish');

  const mine: FeedItem[] = published
    .filter((p) => p.source === 'user')
    .map((post) => ({ post, kind: 'mine', literal: literalMatches(post, profile) }));

  const ordinary: (FeedItem & { score: number })[] = published.flatMap((post) => {
    const gap = gapBetween(post, profile);
    if (post.source === 'user' || gap === undefined || gap >= MIN_GAP) return [];
    const literal = literalMatches(post, profile);
    return [
      {
        post,
        kind: gap <= 20 ? ('aligned' as const) : ('nearby' as const),
        gap,
        literal,
        // Generated posts exist because this reader's interests are missing from the sample.
        score: (literal.length ? 15 : 0) + (post.source === 'generated' ? 30 : 0) - gap,
      },
    ];
  });
  ordinary.sort(
    (a, b) =>
      b.score - a.score ||
      b.post.createdAt.localeCompare(a.post.createdAt) ||
      a.post.id.localeCompare(b.post.id),
  );

  const opposing = published.filter((p) => {
    const gap = gapBetween(p, profile);
    return p.source !== 'user' && gap !== undefined && gap >= MIN_GAP;
  });
  const qualified: (FeedItem & { evidence: Evidence })[] = opposing.flatMap((post) => {
    if (post.confidence < MIN_CONFIDENCE) return [];
    const evidence = strongestEvidence(post, profile, ranks);
    return evidence
      ? [
          {
            post,
            kind: 'bridge' as const,
            gap: gapBetween(post, profile),
            evidence,
            literal: literalMatches(post, profile),
          },
        ]
      : [];
  });
  qualified.sort(
    (a, b) =>
      Number(b.post.source === 'peer') - Number(a.post.source === 'peer') ||
      strength(b.evidence) - strength(a.evidence) ||
      a.literal.length - b.literal.length ||
      a.post.id.localeCompare(b.post.id),
  );

  const chosen: typeof qualified = [];
  const perTopic = new Map<string, number>();
  for (const item of qualified) {
    const used = perTopic.get(item.post.topic ?? '') ?? 0;
    if (used >= MAX_PER_TOPIC) continue;
    perTopic.set(item.post.topic ?? '', used + 1);
    chosen.push(item);
    if (chosen.length === MAX_BRIDGES) break;
  }

  const strip = ({ post, kind, gap, literal, evidence }: FeedItem): FeedItem => ({
    post,
    kind,
    literal,
    ...(gap === undefined ? {} : { gap }),
    ...(evidence ? { evidence } : {}),
  });
  const typical = [...mine, ...ordinary].slice(0, FEED_LENGTH).map(strip);
  const bridge = [...typical];
  chosen.forEach((item, index) =>
    bridge.splice(Math.min(BRIDGE_SLOTS[index]! + mine.length, bridge.length), 0, strip(item)),
  );

  const stats: FeedStats = {
    posts: published.length,
    opposing: opposing.length,
    qualified: qualified.length,
    shown: chosen.length,
    qlooOnly: chosen.filter((c) => c.literal.length === 0).length,
    noEvidence: opposing.length - qualified.length,
  };
  return { typical, bridge: bridge.slice(0, FEED_LENGTH + MAX_BRIDGES), stats };
}
