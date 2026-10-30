import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import {
  ENTITY_TYPES,
  TOPICS,
  TYPE_LABELS,
  type Entity,
  type EntityType,
  type Preset,
  type Profile,
  type StanceChoice,
  type Topic,
} from '../shared/model';
import { searchEntities, type Bootstrap } from './api';

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
  const [stances, setStances] = useState<Profile['stances']>(initial?.stances ?? {});
  const [interests, setInterests] = useState<Entity[]>(initial?.interests ?? []);
  const chosen = TOPICS.filter((t) => stances[t.id]).length;

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
      <header className="intro">
        <h1>Disagreement is easier to read when you share something first.</h1>
        <p>
          Bridge Feed keeps what you believe and what you love apart, then uses the second to reach
          a view you would normally scroll past. The post stays exactly as its author wrote it.
        </p>
      </header>

      {bootstrap.presets.length > 0 && step === 1 && (
        <section className="presets" aria-label="Sample readers">
          <h2>Start as a sample reader</h2>
          <div className="preset-grid">
            {bootstrap.presets.map((preset) => (
              <PresetCard key={preset.id} preset={preset} onPick={onDone} />
            ))}
          </div>
          <p className="or">Or build your own in two steps.</p>
        </section>
      )}

      {step === 1 ? (
        <section className="step" aria-labelledby="step-one">
          <h2 id="step-one">Where do you stand?</h2>
          <p className="hint">Pick at least two topics. Skip any you do not care about.</p>
          <div className="stances">
            {TOPICS.map((topic) => (
              <fieldset key={topic.id}>
                <legend>{topic.label}</legend>
                <div className="choice">
                  {[...topic.stances, { id: 'mixed' as const, label: 'Mixed or unsure' }].map(
                    (option) => (
                      <label key={option.id}>
                        <input
                          type="radio"
                          name={topic.id}
                          checked={stances[topic.id] === option.id}
                          onChange={() =>
                            setStances((s) => ({
                              ...s,
                              [topic.id as Topic]: option.id as StanceChoice,
                            }))
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            ))}
          </div>
          <button className="primary" disabled={chosen < 2} onClick={() => setStep(2)}>
            Choose interests
          </button>
        </section>
      ) : (
        <section className="step" aria-labelledby="step-two">
          <h2 id="step-two">What are you actually into?</h2>
          <p className="hint">
            Pick up to {MAX_INTERESTS}. These go to Qloo as entity IDs. Your views never do.
          </p>
          <EntitySearch selected={interests} onPick={toggle} />
          <div className="catalog">
            {ENTITY_TYPES.map((type) => {
              const items = bootstrap.interests.filter((i) => i.type === type);
              if (!items.length) return null;
              return (
                <div key={type} className="catalog-row">
                  <h3>{TYPE_LABELS[type].one}</h3>
                  <div className="chips">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        className="chip"
                        aria-pressed={interests.some((i) => i.id === item.id)}
                        onClick={() => toggle(item)}
                      >
                        {shortName(item.name)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {interests.length > 0 && (
            <ul className="picked" aria-label="Your interests">
              {interests.map((item) => (
                <li key={item.id}>
                  {shortName(item.name)}
                  <button aria-label={`Remove ${item.name}`} onClick={() => toggle(item)}>
                    <X size={14} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="actions">
            <button className="quiet" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="primary"
              disabled={interests.length < 2}
              onClick={() => onDone({ stances, interests })}
            >
              Build my feed
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function PresetCard({ preset, onPick }: { preset: Preset; onPick: (profile: Profile) => void }) {
  return (
    <button
      className="preset"
      onClick={() => onPick({ stances: preset.stances, interests: preset.interests })}
    >
      <strong>{preset.name}</strong>
      <span>{preset.blurb}</span>
      <em>{preset.interests.map((i) => shortName(i.name)).join(', ')}</em>
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
  const [type, setType] = useState<EntityType>('artist');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchEntities(q, type)
        .then((found) => {
          setResults(found.slice(0, 5));
          setError(found.length ? '' : `Qloo found no ${TYPE_LABELS[type].many} for that.`);
        })
        .catch((e: Error) => setError(e.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, type]);

  return (
    <div className="search">
      <div className="search-bar">
        <Search size={16} aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Qloo for anything else"
          aria-label="Search Qloo"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as EntityType)}
          aria-label="Type"
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t].one}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}
      {results.length > 0 && (
        <div className="chips">
          {results.map((r) => (
            <button
              key={r.id}
              className="chip"
              aria-pressed={selected.some((i) => i.id === r.id)}
              onClick={() => onPick(r)}
            >
              {shortName(r.name)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const shortName = (name: string) =>
  name
    .replace(/\s*\(.*\)$/, '')
    .split(': ')[0]!
    .trim();
