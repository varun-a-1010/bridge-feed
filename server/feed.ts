import { MIN_GAP, composeFeeds, gapBetween } from '../shared/feed';
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
import type { Qloo } from './qloo';

const CONCURRENCY = 5;
/** An entity high on nearly everyone's list is popular, not a connection to this reader. */
export const MAX_COMMONNESS = 0.25;

/** Rank every entity in the feed for each interest alone. No score ever goes to Qloo. */
export async function computeFeed(
  qloo: Qloo,
  corpus: Corpus,
  profile: Profile,
  localPosts: Post[],
): Promise<FeedResponse & { failedQueries: number }> {
  const posts = [...localPosts, ...corpus.posts];
  const byType = indexEntities(posts, corpus.pool);
  const opposingTypes = new Set<EntityType>();
  for (const post of posts) {
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
  const specific = ranks.filter(
    (row) => (corpus.commonness.get(row.entityId) ?? 0) <= MAX_COMMONNESS,
  );
  const feeds = composeFeeds(posts, profile, specific);
  const annotate = (item: FeedItem): FeedItem => {
    const commonness = item.evidence && corpus.commonness.get(item.evidence.entity.id);
    return item.evidence && commonness !== undefined
      ? { ...item, evidence: { ...item.evidence, commonness } }
      : item;
  };
  return {
    ...feeds,
    typical: feeds.typical,
    bridge: feeds.bridge.map(annotate),
    receipts,
    failedQueries,
  };
}
