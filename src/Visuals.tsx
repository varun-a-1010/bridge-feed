import { useState } from 'react';
import type { Entity, Hero } from '../shared/model';
import { TYPE_LABELS } from '../shared/model';
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

export function ScoreLine({ you, them, name }: { you: number; them: number; name: string }) {
  const left = Math.min(you, them);
  return (
    <div
      className="score-line"
      role="img"
      aria-label={`You score ${you}. ${name} scores ${them}. ${Math.abs(you - them)} points apart.`}
    >
      <div className="score-track">
        <span
          className="score-gap"
          style={{ left: `${left}%`, width: `${Math.abs(you - them)}%` }}
        />
        <span className="score-dot you" style={{ left: `${you}%` }} />
        <span className="score-dot them" style={{ left: `${them}%` }} />
      </div>
      <div className="score-labels">
        <span>You {you}</span>
        <span>{Math.abs(you - them)} apart</span>
        <span>
          {name.split(' ')[0]} {them}
        </span>
      </div>
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
          <path
            className="main-cable"
            d="M0 130 L240 40 Q600 300 960 40 L1200 130"
            pathLength={1}
          />
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
        Qloo compared {hero.of} {label.many} for {interest} alone, and {reference} ranked #
        {hero.rank}. That is how a post you would never see finds you.
      </figcaption>
    </figure>
  );
}
