import { useState } from 'react';
import {
  TOPICS,
  type AgentResult,
  type AgentStep,
  type Post,
  type Preset,
  type Profile,
  type Topic,
} from '../shared/model';
import { analyze } from './api';

const EXAMPLES: Record<Topic, { low: string; high: string }> = {
  ai_art: {
    low: 'Blue Eye Samurai took years of careful work by real artists, and you can feel it in every frame. That is why I do not want generated images anywhere near finished animation.',
    high: 'Toy Story scared people too, and computers did not kill animation. AI is just the next tool, and the good artists will use it.',
  },
  animal_welfare: {
    low: 'Parts Unknown taught me that sharing a stranger’s meal is how you respect them. I eat meat, I enjoy it, and I do not think that needs defending.',
    high: 'Cowspiracy made it impossible for me to keep eating the way I did. If we can live well without killing animals, I think we should stop.',
  },
  free_speech: {
    low: 'The Daily Show has mocked everyone in power for decades, and that is exactly why it matters. Nobody should get to decide what comedians can say.',
    high: '13 Reasons Why showed what online cruelty does to a kid. Platforms should take hate down, even when it is legal.',
  },
  privacy: {
    low: 'Tony Stark talking to Jarvis in Iron Man is the dream. I want my home to run itself, and I am happy for companies to hold my data as long as they keep it secure.',
    high: 'I loved The Sims as a kid, but I do not want my real house to work that way. Every smart speaker and camera is one more thing watching us. We took ours out of the bedroom and they are staying out.',
  },
  success: {
    low: 'The Pursuit of Happyness gets me every time. He had nothing and he worked his way out. Most people can change their lives if they refuse to quit.',
    high: 'The Great Gatsby is still right about America. All the hard work in the world will not get you past old money. Where you start decides nearly everything.',
  },
  personal_freedom: {
    low: 'Casino shows how ugly gambling can get, and I still think it is nobody else’s business. Adults should be free to take their own risks.',
    high: 'Trainspotting makes addiction look almost fun until it does not. Some things are too dangerous to leave to personal choice, and we should limit them.',
  },
};

/** Examples speak for the reader's own side, starting with their strongest opinions. */
const examplesFor = (scores: Profile['scores']) =>
  TOPICS.filter((topic) => scores[topic.id] !== undefined)
    .sort((a, b) => Math.abs(scores[b.id]! - 50) - Math.abs(scores[a.id]! - 50))
    .map((topic) => EXAMPLES[topic.id][scores[topic.id]! < 50 ? 'low' : 'high']);

export function Compose({
  connected,
  presets,
  scores,
  onPublish,
  onViewAs,
  onClose,
}: {
  connected: boolean;
  presets: Preset[];
  scores: Profile['scores'];
  onPublish: (post: Post) => void;
  onViewAs: (preset: Preset) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [example, setExample] = useState(0);
  const examples = examplesFor(scores);
  const useExample = () => {
    if (!examples.length) return;
    setText(examples[example % examples.length]!);
    setExample(example + 1);
  };
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
        Take a position on one of the six topics and name a film, artist, brand or team. An agent
        scores it, finds those references on Qloo and works out who it could reach.
      </p>
      <textarea
        value={text}
        maxLength={500}
        rows={4}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you actually think? Name a film, show, artist, team or brand."
        aria-label="Your post"
      />
      <div className="actions">
        <button className="quiet" onClick={useExample} disabled={busy || !examples.length}>
          {example === 0 ? 'Use an example from your side' : 'Try another example'}
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
                const reader = r.reader ?? presets.find((p) => p.id === r.audienceId);
                return (
                  <li key={r.audienceId}>
                    <div>
                      <strong>{r.audience}</strong>
                      <p>
                        {r.outcome === 'bridge' && r.evidence
                          ? `Scores ${r.score} here, so this is a real difference. ${r.evidence.interest} ranks ${r.evidence.entity} #${r.evidence.rank} of ${r.evidence.of}.`
                          : r.outcome === 'same_side'
                            ? `Scores ${r.score} here, close to your post.`
                            : `Scores ${r.score} here, but Qloo found no connection.`}
                      </p>
                    </div>
                    {reader && r.outcome === 'bridge' && (
                      <button className="quiet" onClick={() => onViewAs(reader)}>
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
