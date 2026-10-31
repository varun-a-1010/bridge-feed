import { useState } from 'react';
import {
  TOPICS,
  tierFor,
  type AgentResult,
  type AgentStep,
  type Post,
  type Preset,
  type Profile,
  type Topic,
} from '../shared/model';
import { analyze } from './api';
import { EntityImage, PositionLine } from './Visuals';

const EXAMPLES: Record<Topic, { low: string; high: string }> = {
  ai_art: {
    low: 'Blue Eye Samurai took years of careful work by real artists, and you can feel it in every frame. That is why I do not want generated images anywhere near finished animation.',
    high: 'Ready Player One got one thing right: people will build worlds with whatever tools they get. AI is just the next tool, and the good artists will use it.',
  },
  animal_welfare: {
    low: 'The Bear made me fall in love with a working kitchen. I eat meat, I enjoy it, and I do not think that makes me a bad person.',
    high: 'Okja made it impossible for me to keep eating the way I did. If we can live well without killing animals, I think we should.',
  },
  free_speech: {
    low: 'The Daily Show has mocked everyone in power for decades, and that is exactly why it matters. Nobody should get to decide what comedians can say.',
    high: 'Euphoria showed what online cruelty does to a kid. Platforms should take hate down, even when it is legal.',
  },
  privacy: {
    low: 'The way Her imagines talking to your devices is the future I want. I want a home that knows me, and I am happy for companies to hold my data if they keep it safe.',
    high: 'Black Mirror has stopped feeling like fiction. Every smart speaker and camera is one more thing watching me, and I want all of it off by default.',
  },
  success: {
    low: 'The Last Dance gets me every time. Nobody handed Jordan anything. Most people can change their lives if they put in the work.',
    high: 'Parasite is still right. All the hard work in the world will not get you past old money. Where you start decides most of where you end up.',
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
  const bridges = result?.reach.filter((r) => r.outcome === 'bridge') ?? [];

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
        <h2>Say what you think</h2>
        <button className="quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="hint">
        Other platforms show your post to people who already agree. Take a side on one of the six
        topics and mention something you love, and we will show you who it could reach instead.
      </p>
      <textarea
        value={text}
        maxLength={500}
        rows={4}
        onChange={(e) => setText(e.target.value)}
        placeholder="Take a side, and mention a film, show, artist, team or brand."
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

      {busy && steps.length > 0 && (
        <ol className="trace" aria-live="polite">
          {steps.map((step) => (
            <li key={step.id} className={`trace-${step.kind}`}>
              <strong>{step.title}</strong>
              <span className="source">{step.model ?? step.provenance}</span>
            </li>
          ))}
          <li className="trace-working">Working on the next step</li>
        </ol>
      )}

      {result && (
        <div className="outcome">
          {result.status === 'held' ? (
            <p className="outcome-lead">This post was not published. {result.note}</p>
          ) : (
            <>
              {result.post.position !== null && (
                <>
                  <p className="reads-line">
                    Your post reads as “{tierFor(result.post.topic, result.post.position)}”
                  </p>
                  <PositionLine topic={result.post.topic} score={result.post.position} />
                </>
              )}
              {bridges.length > 0 ? (
                <>
                  <p className="outcome-lead">
                    It could reach {bridges.length}{' '}
                    {bridges.length === 1 ? 'person who disagrees' : 'people who disagree'} with
                    you.
                  </p>
                  <ul className="reach">
                    {bridges.map((r) => {
                      const reader = r.reader ?? presets.find((p) => p.id === r.audienceId);
                      return (
                        <li key={r.audienceId}>
                          {reader?.interests[0] && <EntityImage entity={reader.interests[0]} />}
                          <div>
                            <strong>{r.audience}</strong>
                            <p>{r.evidence?.reason}</p>
                          </div>
                          {reader && (
                            <button className="quiet" onClick={() => onViewAs(reader)}>
                              See it in their feed
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="outcome-lead">
                  Nothing connected strongly enough to carry this one across. Your own feed has it,
                  and we never force a link. Naming something more specific can help.
                </p>
              )}
            </>
          )}
          {steps.length > 0 && (
            <details className="agent-steps">
              <summary>How the agent got here</summary>
              <ol className="trace">
                {steps.map((step) => (
                  <li key={step.id} className={`trace-${step.kind}`}>
                    <div>
                      <strong>{step.title}</strong>
                      {step.detail && <p>{step.detail}</p>}
                    </div>
                    <span className="source">{step.model ?? step.provenance}</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
