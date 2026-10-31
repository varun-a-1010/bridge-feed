import { MAX_BRIDGES, MIN_GAP, candidateCutoff, composeFeeds, gapBetween } from '../shared/feed';
import {
  type EntityType,
  type FeedItem,
  type FeedResponse,
  type Post,
  type Profile,
  type RankRow,
  type Receipt,
} from '../shared/model';
import { indexEntities, type Corpus } from './corpus';
import type { Linker } from './links';
import type { Qloo } from './qloo';

const CONCURRENCY = 5;
/** An entity high on nearly everyone's list is popular, not a connection to this reader. */
export const MAX_COMMONNESS = 0.25;
/** Below this, a custom reader's feed gets generated posts around all of their interests. */
const MIN_BRIDGES = 4;

/** Rank every entity in the feed for each interest alone. No score ever goes to Qloo. */
export async function computeFeed(
  qloo: Qloo,
  corpus: Corpus,
  profile: Profile,
  localPosts: Post[],
  linker?: Linker,
): Promise<FeedResponse & { failedQueries: number }> {
  const posts = [...localPosts, ...corpus.posts];
  // Generated posts bring their own rankings, so they never change what is compared here.
  const ranked = posts.filter((post) => post.source !== 'generated');
  const byType = indexEntities(ranked, corpus.pool);
  const opposingTypes = new Set<EntityType>();
  for (const post of ranked) {
    const gap = gapBetween(post, profile);
    if (gap !== undefined && gap >= MIN_GAP)
      post.entities.forEach((e) => opposingTypes.add(e.type));
  }
  const jobs = profile.interests.flatMap((interest) =>
    [...opposingTypes].map((type) => ({ interest, type })),
  );
  const ranks: RankRow[] = [];
  const receipts: Receipt[] = [];
  let failedQueries = 0;
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const { interest, type } = jobs[next++]!;
        try {
          const answer = await qloo.rank(interest, type, byType.get(type) ?? []);
          ranks.push(...answer.rows);
          receipts.push(answer.receipt);
        } catch {
          failedQueries++;
        }
      }
    }),
  );
  ranks.push(...localPosts.flatMap((post) => post.ranks ?? []));
  const specific = ranks.filter(
    (row) => (corpus.commonness.get(row.entityId) ?? 0) <= MAX_COMMONNESS,
  );
  const opposing = posts.filter((post) => {
    const gap = gapBetween(post, profile);
    return gap !== undefined && gap >= MIN_GAP;
  });
  const entities = opposing.flatMap((post) => post.entities);
  const approved = linker ? await linker.approve(specific, entities, profile.interests) : specific;
  const feeds = composeFeeds(posts, profile, approved);
  const annotate = (item: FeedItem): FeedItem => {
    if (!item.evidence) return item;
    const commonness = corpus.commonness.get(item.evidence.entity.id);
    const reason = linker?.reason(item.evidence.interest.id, item.evidence.entity.id);
    return {
      ...item,
      evidence: {
        ...item.evidence,
        ...(commonness === undefined ? {} : { commonness }),
        ...(reason ? { reason } : {}),
      },
    };
  };
  const inCutoff = specific.filter(
    (row) => row.rank <= candidateCutoff(row.of) && entities.some((e) => e.id === row.entityId),
  );
  // Unreviewed links only matter when the reader's feed came up short because of them.
  const short = feeds.bridge.filter((item) => item.kind === 'bridge').length < MAX_BRIDGES;
  const idsOf = (interests: { id: string }[]) =>
    interests
      .map((i) => i.id)
      .sort()
      .join();
  const sample = corpus.presets.some((p) => idsOf(p.interests) === idsOf(profile.interests));
  const reached = new Set(feeds.bridge.flatMap((item) => item.evidence?.interest.id ?? []));
  return {
    ...feeds,
    typical: feeds.typical,
    bridge: feeds.bridge.map(annotate),
    receipts,
    failedQueries,
    uncheckedLinks: linker && short ? linker.unchecked(inCutoff) : 0,
    uncovered: sample
      ? []
      : profile.interests
          .map((i) => i.id)
          .filter((id) => !reached.has(id) || feeds.stats.shown < MIN_BRIDGES),
  };
}
