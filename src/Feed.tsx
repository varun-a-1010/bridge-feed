import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  TYPE_LABELS,
  tierFor,
  type FeedItem,
  type Post,
  type Profile,
  type Topic,
} from '../shared/model';
import type { Feed } from './api';
import { shortName } from './names';
import { Avatar, EntityImage, PositionLine, ScoreLine, distanceLabel } from './Visuals';

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
      {evidence.reason && (
        <div>
          <dt>Why these connect, checked by Gemini</dt>
          <dd>{evidence.reason}</dd>
        </div>
      )}
      <div>
        <dt>From Qloo</dt>
        <dd>
          Qloo compared {evidence.of} {label.many} for {shortName(evidence.interest.name)} alone,
          and {shortName(evidence.entity.surface)} ranked #{evidence.rank}.
          {evidence.commonness !== undefined &&
            ` Only ${Math.round(evidence.commonness * 100)}% of the interests we tested rank it this high, so it is not a link everyone gets.`}
        </dd>
      </div>
      <div>
        <dt>
          {post.source === 'generated'
            ? 'Written by Gemini to argue this position'
            : 'From the post itself, read by Gemini'}
        </dt>
        <dd>It reads closest to “{tierFor(post.topic, post.position ?? 50)}”</dd>
      </div>
      <div>
        <dt>Our call, not Qloo’s</dt>
        <dd>
          Calling this a bridge is this app’s interpretation. Qloo says nothing about what fans of
          anything believe.
        </dd>
      </div>
    </dl>
  );
}

/** Whose feed this is. Viewing a sample reader speaks about them, never as "you". */
type Voice = { name?: string };
const them = (v: Voice) => v.name ?? 'you';
const They = (v: Voice) => v.name ?? 'You';

function Card({
  item,
  onRemove,
  voice = {},
}: {
  item: FeedItem;
  onRemove?: (id: string) => void;
  voice?: Voice;
}) {
  const [open, setOpen] = useState(false);
  const { post, evidence, kind } = item;
  return (
    <article className={`post post-${kind}`}>
      <header>
        <Avatar name={post.author} />
        <div className="byline">
          <strong>{post.author}</strong>
          <span className="meta">
            {post.source === 'seed'
              ? `Sample post, ${when(post.createdAt)}`
              : post.source === 'generated'
                ? `Simulated post, written by Gemini, ${when(post.createdAt)}`
                : post.source === 'peer'
                  ? `Your post, as ${voice.name ?? 'this reader'} sees it`
                  : 'Your post'}
          </span>
        </div>
      </header>
      <PostText post={post} bridgeRef={evidence?.entity.surface} />
      {post.entities.length > 0 && (
        <ul className="refs">
          {post.entities.map((entity) => (
            <li
              key={entity.id}
              className={entity.id === evidence?.entity.id ? 'ref-card is-bridge' : 'ref-card'}
            >
              <EntityImage entity={entity} />
              <div>
                <strong>{shortName(entity.name)}</strong>
                <span>{TYPE_LABELS[entity.type].one}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <footer>
        {post.position !== null && <PositionLine topic={post.topic} score={post.position} />}
        {post.position !== null && (
          <span className="reads-as">
            {kind === 'mine' || post.source === 'peer' ? 'Your post reads as' : 'Reads as'} “
            {tierFor(post.topic, post.position)}”
          </span>
        )}
        {kind === 'bridge' && item.gap !== undefined && (
          <span className="differs">
            {distanceLabel(item.gap)} from {them(voice)}
          </span>
        )}
        {item.literal.length > 0 && (
          <span className="topic">
            {They(voice)} also named {item.literal.map(shortName).join(', ')}
          </span>
        )}
        {onRemove && (
          <button className="link remove-post" onClick={() => onRemove(post.id)}>
            Delete post
          </button>
        )}
      </footer>
      {evidence && (
        <>
          <button className="why-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
            Why this reached {them(voice)}
            <ChevronDown size={15} aria-hidden className={open ? 'flip' : ''} />
          </button>
          {open && <Why item={{ ...item, evidence }} />}
        </>
      )}
    </article>
  );
}

function Crossing({ item, profile, voice }: { item: FeedItem; profile: Profile; voice: Voice }) {
  const { post, evidence } = item;
  const yours = profile.scores[post.topic as Topic];
  return (
    <li className="crossing">
      <div className="crossing-inner">
        <div className="near">
          <EntityImage entity={evidence!.interest} className="near-image" />
          <p>
            Because {voice.name ? `${voice.name} likes` : 'you like'}{' '}
            <strong>{shortName(evidence!.interest.name)}</strong>
          </p>
          {evidence!.reason && <p className="link-reason">{evidence!.reason}</p>}
          {yours !== undefined && post.position !== null && (
            <ScoreLine
              topic={post.topic}
              you={yours}
              them={post.position}
              self={They(voice)}
              name={post.source === 'peer' ? 'You' : post.author}
            />
          )}
        </div>
        <svg className="cable" viewBox="0 0 120 60" preserveAspectRatio="none" aria-hidden>
          <path d="M0 30 C 40 2, 80 2, 120 30" />
        </svg>
        <div className="far">
          <Card item={item} voice={voice} />
        </div>
      </div>
    </li>
  );
}

export function FeedView({
  feed,
  mode,
  profile,
  onRate,
  onRemove,
  filling,
  reader,
}: {
  feed: Feed;
  mode: 'typical' | 'bridge';
  profile: Profile;
  filling?: boolean;
  /** The sample reader being viewed, if this is not the visitor's own feed. */
  reader?: string;
  onRate?: () => void;
  onRemove?: (id: string) => void;
}) {
  const items = mode === 'bridge' ? feed.bridge : feed.typical;
  const voice: Voice = { name: reader };
  const { stats } = feed;
  const recorded = feed.receipts.find((r) => r.source === 'recorded');
  return (
    <>
      {mode === 'bridge' ? (
        <p className="summary">
          {stats.shown === 0
            ? `Nothing from outside ${voice.name ? 'their' : 'your'} bubble cleared the bar, so nothing was forced in. Try different interests.`
            : voice.name
              ? `${stats.shown} ${stats.shown === 1 ? 'post' : 'posts'} reached ${voice.name} from outside their bubble, out of ${stats.opposing} that disagree with them. Each one connects to something they love.`
              : `${stats.shown} ${stats.shown === 1 ? 'post' : 'posts'} reached you from outside your bubble, out of ${stats.opposing} that disagree with you. Each one connects to something you love.`}
        </p>
      ) : (
        <p className="summary">
          {voice.name
            ? `This is ${voice.name}’s bubble, ranked the way most platforms would: closest to their scores first.`
            : 'This is your bubble, ranked the way most platforms would: closest to your scores first.'}{' '}
          {stats.opposing}{' '}
          {stats.opposing === 1 ? 'post that disagrees stays' : 'posts that disagree stay'} out of
          sight.
        </p>
      )}
      {filling && (
        <p className="note" role="status">
          Your interests go beyond our sample posts, so Gemini is writing a few around them.
        </p>
      )}
      {mode === 'bridge' && feed.failedQueries > 0 && (
        <p className="note">
          Qloo missed {feed.failedQueries} of {feed.failedQueries + feed.receipts.length} lookups,
          so a bridge may be missing. Nothing is guessed in its place.
        </p>
      )}
      {mode === 'bridge' && feed.uncheckedLinks > 0 && (
        <p className="note">
          Some possible links are still unreviewed, so they are left out. A link only appears once
          it makes sense.
        </p>
      )}
      <ol className={`feed feed-${mode}`}>
        {items.map((item) =>
          mode === 'bridge' && item.kind === 'bridge' ? (
            <Crossing key={item.post.id} item={item} profile={profile} voice={voice} />
          ) : (
            <li key={item.post.id} className="row">
              <Card
                item={item}
                voice={voice}
                onRemove={item.kind === 'mine' ? onRemove : undefined}
              />
            </li>
          ),
        )}
      </ol>
      {mode === 'bridge' && onRate && stats.shown > 0 && (
        <aside className="checkin">
          <p>
            You read {stats.shown} {stats.shown === 1 ? 'post' : 'posts'} from outside your bubble.
            Did anything shift?
          </p>
          <button className="primary" onClick={onRate}>
            Rate again
          </button>
        </aside>
      )}
      <footer className="fine-print">
        <p>
          {voice.name ? `${voice.name}’s interests` : 'Your interests'}:{' '}
          {profile.interests.map((i) => shortName(i.name)).join(', ')}. Sample posts are by
          fictional authors, and each score is read from the post by Gemini. Qloo rankings show
          cultural association, not anyone’s beliefs.
          {recorded &&
            ` Rankings recorded from Qloo on ${new Date(recorded.retrievedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}
        </p>
      </footer>
    </>
  );
}
