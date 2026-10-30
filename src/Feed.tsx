import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { bridgeCutoff, MIN_GAP } from '../shared/feed';
import {
  TYPE_LABELS,
  tierFor,
  topicOf,
  type FeedItem,
  type Post,
  type Profile,
  type Topic,
} from '../shared/model';
import type { Feed } from './api';
import { shortName } from './Onboarding';

const when = (iso: string) => {
  const hours = Math.max(
    1,
    Math.round((Date.parse('2026-10-31T00:00:00Z') - Date.parse(iso)) / 36e5),
  );
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

function PostText({ post, bridgeRef }: { post: Post; bridgeRef?: string }) {
  const surfaces = post.entities.map((e) => e.surface).filter(Boolean);
  if (!surfaces.length) return <p className="post-text">{post.text}</p>;
  const pattern = new RegExp(
    `(${surfaces.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi',
  );
  return (
    <p className="post-text">
      {post.text.split(pattern).map((part, index) => {
        const match = surfaces.find((s) => s.toLowerCase() === part.toLowerCase());
        if (!match) return part;
        const isBridge = match.toLowerCase() === bridgeRef?.toLowerCase();
        return (
          <mark key={index} className={isBridge ? 'ref bridge-ref' : 'ref'}>
            {part}
          </mark>
        );
      })}
    </p>
  );
}

function Why({ item }: { item: FeedItem & { evidence: NonNullable<FeedItem['evidence']> } }) {
  const { post, evidence } = item;
  const label = TYPE_LABELS[evidence.entity.type];
  return (
    <dl className="why">
      <div>
        <dt>From the post itself, read by Gemini</dt>
        <dd>
          It scores {post.position} on {topicOf(post.topic)?.label}, closest to “
          {tierFor(post.topic, post.position ?? 50)}”. Confidence {post.confidence.toFixed(2)}.
        </dd>
      </div>
      <div>
        <dt>From Qloo</dt>
        <dd>
          Qloo compared {evidence.of} {label.many} for {shortName(evidence.interest.name)} alone,
          and {shortName(evidence.entity.surface)} ranked #{evidence.rank}.
          {evidence.alsoSupportedBy.length > 0 &&
            ` ${evidence.alsoSupportedBy.map((s) => `${shortName(s.interest)} also placed it #${s.rank}`).join('. ')}.`}
          {evidence.commonness !== undefined &&
            ` Only ${Math.round(evidence.commonness * 100)}% of the interests we tested rank it this high, so it is not a link everyone gets.`}
        </dd>
      </div>
      <div>
        <dt>Our call, not Qloo’s</dt>
        <dd>
          You are {item.gap} points apart, and it reached the top {bridgeCutoff(evidence.of)}.
          Calling that a bridge is this app’s interpretation. Qloo says nothing about what fans of
          anything believe.
        </dd>
      </div>
    </dl>
  );
}

function Card({ item, wide }: { item: FeedItem; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const { post, evidence, kind } = item;
  return (
    <article className={`post post-${kind}${wide ? ' wide' : ''}`}>
      <header>
        <div className="byline">
          <strong>{post.author}</strong>
          {post.position !== null && (
            <span className="author-score" title={tierFor(post.topic, post.position)}>
              {post.position}
            </span>
          )}
        </div>
        <span className="meta">
          {post.source === 'seed'
            ? `Sample post, ${when(post.createdAt)}`
            : post.source === 'peer'
              ? 'Your post, as this reader sees it'
              : 'Your post'}
        </span>
      </header>
      <PostText post={post} bridgeRef={evidence?.entity.surface} />
      <footer>
        <span className="topic">{topicOf(post.topic)?.label ?? 'Off topic'}</span>
        {kind === 'bridge' && <span className="differs">{item.gap} points from you</span>}
        {item.literal.length > 0 && (
          <span className="topic">You also named {item.literal.map(shortName).join(', ')}</span>
        )}
      </footer>
      {evidence && (
        <>
          <button className="why-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            Why this reached you
            <ChevronDown size={15} aria-hidden className={open ? 'flip' : ''} />
          </button>
          {open && <Why item={{ ...item, evidence }} />}
        </>
      )}
    </article>
  );
}

function Crossing({ item, profile }: { item: FeedItem; profile: Profile }) {
  const yours = profile.scores[item.post.topic as Topic];
  return (
    <li className="row crossing">
      <div className="near-bank">
        <span className="you-score">You {yours}</span>
        <span className="anchor">{shortName(item.evidence!.interest.name)}</span>
      </div>
      <div className="span">
        <svg className="cable" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 30 C 40 2, 80 2, 120 30" pathLength={1} />
        </svg>
      </div>
      <div className="far-bank">
        <Card item={item} />
      </div>
    </li>
  );
}

export function FeedView({
  feed,
  mode,
  profile,
  onRate,
}: {
  feed: Feed;
  mode: 'typical' | 'bridge';
  profile: Profile;
  onRate?: () => void;
}) {
  const items = mode === 'bridge' ? feed.bridge : feed.typical;
  const { stats } = feed;
  const recorded = feed.receipts.find((r) => r.source === 'recorded');
  return (
    <>
      {mode === 'bridge' ? (
        <p className="summary">
          {stats.shown === 0
            ? 'No post cleared the bar, so nothing was forced in. Try different interests.'
            : `${stats.shown} ${stats.shown === 1 ? 'post' : 'posts'} crossed over from the ${stats.opposing} at least ${MIN_GAP} points from your scores. ${stats.qlooOnly} of them ${stats.qlooOnly === 1 ? 'shares' : 'share'} no title with your interests, so matching words alone would have missed ${stats.qlooOnly === 1 ? 'it' : 'them'}.`}
        </p>
      ) : (
        <p className="summary">
          Same posts, ranked the usual way: closest to your scores first. {stats.opposing}{' '}
          {stats.opposing === 1 ? 'post that disagrees stays' : 'posts that disagree stay'} out of
          sight.
        </p>
      )}
      {feed.failedQueries > 0 && (
        <p className="error">
          Qloo did not answer {feed.failedQueries} of its queries, so some bridges may be missing.
          No connection is ever guessed in their place.
        </p>
      )}
      <ol className={`feed feed-${mode}`}>
        {items.map((item) =>
          mode === 'bridge' && item.kind === 'bridge' ? (
            <Crossing key={item.post.id} item={item} profile={profile} />
          ) : (
            <li key={item.post.id} className="row">
              <Card item={item} wide={mode === 'typical'} />
            </li>
          ),
        )}
      </ol>
      {mode === 'bridge' && onRate && stats.shown > 0 && (
        <aside className="checkin">
          <p>You read {stats.shown} posts you would not normally see. Did anything shift?</p>
          <button className="primary" onClick={onRate}>
            Rate again
          </button>
        </aside>
      )}
      <footer className="fine-print">
        <p>
          Your interests: {profile.interests.map((i) => shortName(i.name)).join(', ')}. Sample posts
          are by fictional authors, and each score is read from the post by Gemini. Qloo rankings
          show cultural association, not anyone’s beliefs.
          {recorded &&
            ` Rankings recorded from Qloo on ${new Date(recorded.retrievedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}
        </p>
      </footer>
    </>
  );
}
