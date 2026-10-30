import { useState } from 'react';
import type { AgentResult, AgentStep, Post, Preset } from '../shared/model';
import { analyze } from './api';

const SAMPLE =
  'I love how easy smart speakers make the kitchen, but Black Mirror made me unplug the one in our bedroom. Convenience is not worth a microphone by the bed.';

export function Compose({
  connected,
  presets,
  onPublish,
  onViewAs,
  onClose,
}: {
  connected: boolean;
  presets: Preset[];
  onPublish: (post: Post) => void;
  onViewAs: (preset: Preset) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AgentResult>();

  async function publish() {
    setBusy(true);
    setError('');
    setSteps([]);
    setResult(undefined);
    try {
      const outcome = await analyze(text, (step) => setSteps((list) => [...list, step]));
      setResult(outcome);
      if (outcome.status !== 'held') onPublish(outcome.post);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="compose" aria-label="Write a post">
      <div className="compose-head">
        <h2>Write a post</h2>
        <button className="quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="hint">
        Take a side on one of the six topics and name a film, artist, brand or place. An agent reads
        it, finds those references on Qloo and works out who it could reach.
      </p>
      <textarea
        value={text}
        maxLength={500}
        rows={4}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE}
        aria-label="Your post"
      />
      <div className="actions">
        <button className="quiet" onClick={() => setText(SAMPLE)} disabled={busy}>
          Use the example
        </button>
        <span className="count">{text.length} of 500</span>
        <button
          className="primary"
          disabled={busy || text.trim().length < 12 || !connected}
          onClick={publish}
        >
          {busy ? 'Publishing' : 'Publish'}
        </button>
      </div>
      {!connected && <p className="error">The agent is not connected on this server.</p>}
      {error && <p className="error">{error}</p>}

      {steps.length > 0 && (
        <ol className="trace" aria-live="polite">
          {steps.map((step) => (
            <li key={step.id} className={`trace-${step.kind}`}>
              <div>
                <strong>{step.title}</strong>
                {step.detail && <p>{step.detail}</p>}
              </div>
              <span className="source">{step.model ?? step.provenance}</span>
            </li>
          ))}
          {busy && <li className="trace-working">Working on the next step</li>}
        </ol>
      )}

      {result && (
        <div className="outcome">
          <p>{result.note}</p>
          {result.reach.length > 0 && (
            <ul className="reach">
              {result.reach.map((r) => {
                const preset = presets.find((p) => p.id === r.audienceId);
                return (
                  <li key={r.audienceId}>
                    <div>
                      <strong>{r.audience}</strong>
                      <p>
                        {r.outcome === 'bridge' && r.evidence
                          ? `Holds the other view. ${r.evidence.interest} ranks ${r.evidence.entity} #${r.evidence.rank} of ${r.evidence.of}.`
                          : r.outcome === 'same_side'
                            ? 'Already on your side.'
                            : 'Holds the other view, but Qloo found no connection.'}
                      </p>
                    </div>
                    {preset && result.status !== 'held' && r.outcome !== 'no_evidence' && (
                      <button className="quiet" onClick={() => onViewAs(preset)}>
                        See their feed
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
