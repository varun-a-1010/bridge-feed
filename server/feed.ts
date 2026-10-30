import { composeFeeds } from '../shared/feed';
import {
  type EntityType,
  type FeedResponse,
  type Post,
  type Profile,
  type RankRow,
  type Receipt,
  type Topic,
} from '../shared/model';
import { indexEntities, type Corpus } from './corpus';
import type { Qloo } from './qloo';

const CONCURRENCY = 5;

/** Rank every entity in the feed for each interest alone. No stance ever goes to Qloo. */
export async function computeFeed(
  qloo: Qloo,
  corpus: Corpus,
  profile: Profile,
  localPosts: Post[],
): Promise<FeedResponse & { failedQueries: number }> {
  const posts = [...localPosts, ...corpus.posts];
  const byType = indexEntities(posts);
  const opposingTypes = new Set<EntityType>();
  for (const post of posts) {
    const stance = post.topic ? profile.stances[post.topic as Topic] : undefined;
    if (stance && stance !== 'mixed' && post.viewpoint && post.viewpoint !== stance)
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
  return { ...composeFeeds(posts, profile, ranks), receipts, failedQueries };
}
