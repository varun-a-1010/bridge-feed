import { useState } from 'react';
import { TOPICS, tierFor, type Profile, type Topic } from '../shared/model';
import { Scale } from './Scale';

type Scores = Profile['scores'];

export function ScoresPanel({
  baseline,
  scores,
  rating,
  onRate,
  onSave,
  onRestart,
  onClose,
}: {
  baseline: Scores;
  scores: Scores;
  rating: boolean;
  onRate: () => void;
  onSave: (scores: Scores) => void;
  onRestart: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Scores>(scores);
  const rated = TOPICS.filter((t) => scores[t.id] !== undefined);
  const moved = rated.filter((t) => scores[t.id] !== baseline[t.id]);
  const unchanged = rated.every((t) => draft[t.id] === scores[t.id]);

  if (rating)
    return (
      <section className="panel" aria-labelledby="rate-title">
        <h2 id="rate-title">Has anything shifted?</h2>
        <p className="hint">
          Move a score only if what you read changed how you see it, in either direction. Staying
          where you are is a real answer.
        </p>
        <div className="scales">
          {rated.map((topic) => (
            <Scale
              key={topic.id}
              topic={topic}
              value={draft[topic.id]}
              onChange={(score) =>
                setDraft((current) => ({ ...current, [topic.id as Topic]: score }))
              }
            />
          ))}
        </div>
        <div className="actions">
          <button className="quiet" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={() => onSave(draft)}>
            {unchanged ? 'Save, nothing changed' : 'Save new scores'}
          </button>
        </div>
      </section>
    );

  return (
    <section className="panel" aria-labelledby="scores-title">
      <div className="panel-head">
        <h2 id="scores-title">Your scores</h2>
        <button className="quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="hint">
        {moved.length === 0
          ? 'No change yet. Staying put is a real answer.'
          : `You moved on ${moved.length} of ${rated.length} topics since you started.`}{' '}
        Only you can see your own scores here. Authors’ scores are public and read from their posts.
      </p>
      <ul className="score-list">
        {rated.map((topic) => {
          const now = scores[topic.id]!;
          const start = baseline[topic.id] ?? now;
          const change = now - start;
          return (
            <li key={topic.id}>
              <div className="score-row">
                <strong>{topic.label}</strong>
                <span className="score-values">
                  {change === 0
                    ? `${now}, no change`
                    : `${start} to ${now}, moved ${Math.abs(change)} toward “${change > 0 ? topic.high : topic.low}”`}
                </span>
              </div>
              <p>{tierFor(topic.id, now)}</p>
            </li>
          );
        })}
      </ul>
      <p className="hint">
        On a real platform, these check-ins could show whether a feed changes minds at all. This
        demo only ever sees you, so it measures nothing beyond your own answers.
      </p>
      <div className="actions">
        <button className="quiet" onClick={onRestart}>
          Start over
        </button>
        <button className="primary" onClick={onRate}>
          Rate again
        </button>
      </div>
    </section>
  );
}
