import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  ENTITY_TYPES,
  TOPICS,
  TYPE_LABELS,
  describeEntity,
  type Entity,
  type Preset,
  type Profile,
  type Topic,
} from '../shared/model';
import { searchEntities, type Bootstrap } from './api';
import { Carousel } from './Carousel';
import { shortName } from './names';
import { Scale } from './Scale';
import { EntityImage, HeroBridge } from './Visuals';

const MAX_INTERESTS = 6;

export function Onboarding({
  bootstrap,
  initial,
  onDone,
}: {
  bootstrap: Bootstrap;
  initial?: Profile;
  onDone: (profile: Profile) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const goTo = (next: 1 | 2) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const [scores, setScores] = useState<Profile['scores']>(initial?.scores ?? {});
  const [interests, setInterests] = useState<Entity[]>(initial?.interests ?? []);
  const chosen = TOPICS.filter((t) => scores[t.id] !== undefined).length;

  const groups = [
    { label: 'Sports', items: bootstrap.interests.filter((i) => i.group === 'sports') },
    ...ENTITY_TYPES.map((type) => ({
      label: TYPE_LABELS[type].one,
      items: bootstrap.interests.filter((i) => i.type === type && !i.group),
    })),
  ].filter((group) => group.items.length > 0);

  const toggle = (entity: Entity) =>
    setInterests((list) =>
      list.some((i) => i.id === entity.id)
        ? list.filter((i) => i.id !== entity.id)
        : list.length < MAX_INTERESTS
          ? [...list, entity]
          : list,
    );

  return (
    <main className="onboarding">
      {step === 1 ? (
        <header className="hero">
          <div className="hero-copy">
            <p className="brand">Bridge Feed</p>
            <h1>
              Other platforms keep you in your bubble. This one uses what you love to get you out.
            </h1>
            <p>
              Most social platforms learn what you like and keep showing you people who agree with
              you. Bridge Feed is a prototype of one built the other way around: it brings you views
              you disagree with, and reaches you through the culture you already share.
            </p>
          </div>
          {bootstrap.hero && <HeroBridge hero={bootstrap.hero} />}
        </header>
      ) : (
        <header className="step-bar">
          <p className="brand">Bridge Feed</p>
          <span>Step 2 of 2</span>
        </header>
      )}

      <div className="onboarding-body">
        {bootstrap.presets.length > 0 && step === 1 && (
          <div className="presets">
            <Carousel title="Start as a sample reader">
              {bootstrap.presets.map((preset) => (
                <PresetCard key={preset.id} preset={preset} onPick={onDone} />
              ))}
            </Carousel>
            <p className="or">Or build your own in two steps.</p>
          </div>
        )}

        {step === 1 ? (
          <section className="step" aria-labelledby="step-one">
            <h2 id="step-one">Where do you stand?</h2>
            <p className="hint">
              Score at least two topics. Each number means something specific, so read it before you
              choose. You can rate again after reading your feed.
            </p>
            <div className="scales">
              {TOPICS.map((topic) => (
                <Scale
                  key={topic.id}
                  topic={topic}
                  value={scores[topic.id]}
                  onChange={(score) => setScores((s) => ({ ...s, [topic.id as Topic]: score }))}
                />
              ))}
            </div>
            <button className="primary" disabled={chosen < 2} onClick={() => goTo(2)}>
              Choose interests
            </button>
          </section>
        ) : (
          <section className="step" aria-labelledby="step-two">
            <h2 id="step-two">What are you actually into?</h2>
            <p className="hint">
              Pick up to {MAX_INTERESTS}. These go to Qloo as entity IDs. Your scores never do.
            </p>
            <EntitySearch selected={interests} onPick={toggle} />
            {interests.length > 0 && (
              <ul className="picked" aria-label="Your interests">
                {interests.map((item) => (
                  <li key={item.id}>
                    <EntityImage entity={item} />
                    <div>
                      <strong>{shortName(item.name)}</strong>
                      <span>{describeEntity(item)}</span>
                    </div>
                    <button aria-label={`Remove ${item.name}`} onClick={() => toggle(item)}>
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="catalog">
              {groups.map(({ label, items }) => (
                <div key={label} className="catalog-row">
                  <h3>{label}</h3>
                  <div className="chips">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        className="chip"
                        aria-pressed={interests.some((i) => i.id === item.id)}
                        onClick={() => toggle(item)}
                      >
                        <EntityImage entity={item} />
                        {shortName(item.name)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="actions">
              <button className="quiet" onClick={() => goTo(1)}>
                Back
              </button>
              <button
                className="primary"
                disabled={interests.length < 2}
                onClick={() =>
                  onDone({
                    scores,
                    interests: interests.map(({ id, name, type, image, year }) => ({
                      id,
                      name,
                      type,
                      ...(image ? { image } : {}),
                      ...(year ? { year } : {}),
                    })),
                  })
                }
              >
                Build my feed
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function PresetCard({ preset, onPick }: { preset: Preset; onPick: (profile: Profile) => void }) {
  return (
    <button
      className="preset"
      onClick={() => onPick({ scores: preset.scores, interests: preset.interests })}
    >
      <span className="preset-images" aria-hidden>
        {preset.interests.map((interest) => (
          <EntityImage key={interest.id} entity={interest} />
        ))}
      </span>
      <strong>{preset.name}</strong>
      <span>{preset.blurb}</span>
      <em>{preset.interests.map((i) => shortName(i.name)).join(', ')}</em>
      <small>
        {TOPICS.filter((t) => preset.scores[t.id] !== undefined)
          .map((t) => `${t.label} ${preset.scores[t.id]}`)
          .join(', ')}
      </small>
    </button>
  );
}

function EntitySearch({
  selected,
  onPick,
}: {
  selected: Entity[];
  onPick: (entity: Entity) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError('');
      return;
    }
    const timer = setTimeout(() => {
      searchEntities(q)
        .then((found) => {
          setResults(found);
          setError(found.length ? '' : 'Qloo found nothing for that. Try another spelling.');
        })
        .catch((e: Error) => setError(e.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="search">
      <div className="search-bar">
        <Search size={16} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search films, shows, artists, books, brands and games"
          aria-label="Search Qloo"
        />
      </div>
      {error && <p className="error">{error}</p>}
      {results.length > 0 && (
        <div className="results">
          {results.map((r) => (
            <button
              key={r.id}
              className="result"
              aria-pressed={selected.some((i) => i.id === r.id)}
              onClick={() => onPick(r)}
            >
              <EntityImage entity={r} />
              <span>
                <strong>{shortName(r.name)}</strong>
                <small>{describeEntity(r)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
