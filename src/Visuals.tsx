import { useState } from 'react';
import type { Entity, Hero } from '../shared/model';
import { TYPE_LABELS, leanFor, topicOf } from '../shared/model';
import { shortName } from './names';

const TINTS = ['#2f6672', '#4a7c6f', '#5c6f94', '#7d6a58', '#5f5a82', '#3f7f95'];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

export function Avatar({ name }: { name: string }) {
  const tint = TINTS[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TINTS.length];
  return (
    <span className="avatar" style={{ background: tint }} aria-hidden>
      {initials(name)}
    </span>
  );
}

/** Qloo's image for an entity, or a plain tile when it has none or the image fails. */
export function EntityImage({ entity, className = '' }: { entity: Entity; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!entity.image || failed)
    return (
      <span className={`entity-image entity-tile ${className}`} aria-hidden>
        {initials(shortName(entity.name))}
      </span>
    );
  return (
    <img
      className={`entity-image ${className}`}
      src={entity.image}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** A position between two named ends. No number to decode, and neither end reads as better. */
export function PositionLine({ topic, score }: { topic: string | null; score: number }) {
  const found = topicOf(topic);
  if (!found) return null;
  return (
    <div
      className="position"
      role="img"
      aria-label={`${found.label}: leans ${leanFor(topic, score)}`}
    >
      <span className="position-label">{found.label}</span>
      <div className="position-ends">
        <span>{found.low}</span>
        <span className="position-track">
          <i style={{ left: `${score}%` }} />
        </span>
        <span>{found.high}</span>
      </div>
    </div>
  );
}

export const distanceLabel = (gap: number) =>
  gap >= 80 ? 'Opposite ends' : gap >= 60 ? 'Far apart' : 'Apart';

export function ScoreLine({
  topic,
  you,
  them,
  name,
  self = 'You',
}: {
  topic: string | null;
  you: number;
  them: number;
  name: string;
  /** Whose score "you" is: the visitor, or the sample reader they are viewing as. */
  self?: string;
}) {
  const found = topicOf(topic);
  const first = name.split(' ')[0];
  return (
    <div
      className="score-line"
      role="img"
      aria-label={`On ${found?.label}, ${self === 'You' ? 'you lean' : `${self} leans`} ${leanFor(topic, you)} and ${first === 'You' ? 'you lean' : `${first} leans`} ${leanFor(topic, them)}.`}
    >
      <div className="score-track">
        <span
          className="score-gap"
          style={{ left: `${Math.min(you, them)}%`, width: `${Math.abs(you - them)}%` }}
        />
        <span className="score-dot you" style={{ left: `${you}%` }} />
        <span className="score-dot them" style={{ left: `${them}%` }} />
      </div>
      <div className="score-labels">
        <span>{found?.low}</span>
        <span>{found?.high}</span>
      </div>
      <p className="score-key">
        <i className="key-you" /> {self} <i className="key-them" /> {first}
      </p>
    </div>
  );
}

const WIDTH = 1200;
const curve = (x: number) => {
  const t = (x - 240) / 720;
  return (1 - t) ** 2 * 40 + 2 * t * (1 - t) * 300 + t ** 2 * 40;
};
const HANGERS = Array.from({ length: 11 }, (_, index) => 300 + index * 60);

export function HeroBridge({ hero }: { hero: Hero }) {
  const label = TYPE_LABELS[hero.entity.type];
  const interest = shortName(hero.interest.name);
  const reference = shortName(hero.entity.surface);
  return (
    <figure className="hero-bridge">
      <div className="hero-span">
        <svg viewBox={`0 0 ${WIDTH} 260`} preserveAspectRatio="none" aria-hidden>
          <line className="deck" x1="0" y1="205" x2={WIDTH} y2="205" />
          {HANGERS.map((x) => (
            <line key={x} className="hanger" x1={x} y1={curve(x)} x2={x} y2="205" />
          ))}
          <line className="tower" x1="240" y1="30" x2="240" y2="260" />
          <line className="tower" x1="960" y1="30" x2="960" y2="260" />
        </svg>
        <svg
          className="hero-cable"
          viewBox={`0 0 ${WIDTH} 260`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path className="main-cable" d="M0 130 L240 40 Q600 300 960 40 L1200 130" />
        </svg>
        <div className="hero-end near-end">
          <EntityImage entity={hero.interest} />
          <span>You like {interest}</span>
        </div>
        <div className="hero-end far-end">
          <EntityImage entity={hero.entity} />
          <span>Someone you disagree with loves {reference}</span>
        </div>
      </div>
      <figcaption>
        {hero.reason ?? `${interest} and ${reference} connect.`} Qloo found that link across{' '}
        {hero.of} {label.many}. That is how a post you would never see finds you.
      </figcaption>
    </figure>
  );
}
