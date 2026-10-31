import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Gauge, PenLine } from 'lucide-react';
import type { Post, Preset, Profile } from '../shared/model';
import { fillFeed, getBootstrap, getFeed, loadSaved, save, type Bootstrap, type Feed } from './api';
import { Compose } from './Compose';
import { FeedView } from './Feed';
import { Onboarding } from './Onboarding';
import { ScoresPanel } from './Scores';

export function App() {
  const saved = useMemo(loadSaved, []);
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [profile, setProfile] = useState<Profile | undefined>(saved.profile);
  const [baseline, setBaseline] = useState<Profile['scores']>(saved.baseline ?? {});
  const [posts, setPosts] = useState<Post[]>(saved.posts ?? []);
  const [feed, setFeed] = useState<Feed>();
  const generated = useRef<Post[]>([]);
  const loads = useRef(0);
  const [filling, setFilling] = useState(false);
  const [mode, setMode] = useState<'typical' | 'bridge'>('typical');
  const [viewing, setViewing] = useState<string>();
  const [own, setOwn] = useState<Profile>();
  const [restarting, setRestarting] = useState(false);
  const [panel, setPanel] = useState<'none' | 'write' | 'scores' | 'rate'>('none');
  const [error, setError] = useState('');

  useEffect(() => {
    getBootstrap()
      .then(setBootstrap)
      .catch((e: Error) => setError(e.message));
  }, []);

  const load = useCallback(() => {
    if (!profile) return;
    setError('');
    setFeed(undefined);
    const load = ++loads.current;
    const current = () => load === loads.current;
    const mine = viewing ? posts.map((p) => ({ ...p, source: 'peer' as const })) : posts;
    const extra = viewing ? [] : generated.current;
    getFeed(profile, [...mine, ...extra])
      .then((first) => {
        if (!current()) return;
        setFeed(first);
        if (viewing || extra.length || !first.uncovered.length) return;
        // The curated posts cannot reach everyone, so Gemini writes around what is missing.
        // Anything that fails here leaves the feed the reader already has.
        setFilling(true);
        fillFeed(profile, first.uncovered)
          .then(async ({ posts: written }) => {
            if (!current() || !written.length) return;
            generated.current = written;
            const fuller = await getFeed(profile, [...mine, ...written]);
            if (current()) setFeed(fuller);
          })
          .catch(() => undefined)
          .finally(() => current() && setFilling(false));
      })
      .catch((e: Error) => current() && setError(e.message));
  }, [profile, posts, viewing]);

  useEffect(load, [load]);
  useEffect(
    () => save({ profile: own ?? profile, baseline, posts }),
    [own, profile, baseline, posts],
  );

  const begin = (next: Profile) => {
    generated.current = [];
    setFilling(false);
    setProfile(next);
    setBaseline(next.scores);
    setPosts([]);
    setOwn(undefined);
    setViewing(undefined);
    setRestarting(false);
    setPanel('none');
    setMode('typical');
  };
  const backToOwn = () => {
    if (own) setProfile(own);
    setOwn(undefined);
    setViewing(undefined);
  };
  const viewAs = (preset: Preset) => {
    setOwn((current) => current ?? profile);
    setProfile({ scores: preset.scores, interests: preset.interests });
    setViewing(preset.name);
    setPanel('none');
    setMode('bridge');
  };

  if (!bootstrap)
    return (
      <div className="loading">
        {error ? <p className="error">{error}</p> : <p>Opening the feed</p>}
      </div>
    );
  if (!profile || restarting)
    return (
      <Onboarding
        bootstrap={bootstrap}
        onDone={begin}
        onBack={profile ? () => setRestarting(false) : undefined}
      />
    );

  const yours = own ?? profile;
  return (
    <div className={`shell shell-${mode}`}>
      <header className="topbar">
        <h1 className="wordmark">
          <button onClick={() => setRestarting(true)} aria-label="Bridge Feed, go to the start">
            <svg viewBox="0 0 32 20" aria-hidden>
              <path d="M1 15 C 10 -3, 22 -3, 31 15" />
              <path d="M1 17 H31" />
            </svg>
            Bridge Feed
          </button>
        </h1>
        <div className="mode" role="group" aria-label="Feed type">
          <button aria-pressed={mode === 'typical'} onClick={() => setMode('typical')}>
            Your bubble
          </button>
          <button aria-pressed={mode === 'bridge'} onClick={() => setMode('bridge')}>
            Bridge feed
          </button>
        </div>
        <div className="tools">
          <button
            className="quiet"
            aria-pressed={panel === 'write'}
            onClick={() => setPanel(panel === 'write' ? 'none' : 'write')}
          >
            <PenLine size={15} aria-hidden /> Post your view
          </button>
          <button
            className="quiet"
            aria-pressed={panel === 'scores' || panel === 'rate'}
            onClick={() => setPanel(panel === 'none' || panel === 'write' ? 'scores' : 'none')}
          >
            <Gauge size={15} aria-hidden /> Your scores
          </button>
        </div>
      </header>

      <main className="stage">
        {viewing && (
          <p className="viewing">
            You are viewing this as {viewing}, a sample reader.{' '}
            <button className="link" onClick={backToOwn}>
              Go back to your own feed
            </button>
          </p>
        )}
        {panel === 'write' && (
          <Compose
            connected={bootstrap.connected.agent}
            presets={bootstrap.presets}
            scores={yours.scores}
            onPublish={(post) =>
              setPosts((list) => [post, ...list.filter((p) => p.text !== post.text)].slice(0, 8))
            }
            onViewAs={viewAs}
            onClose={() => setPanel('none')}
          />
        )}
        {(panel === 'scores' || panel === 'rate') && (
          <ScoresPanel
            baseline={baseline}
            scores={yours.scores}
            rating={panel === 'rate'}
            onRate={() => setPanel('rate')}
            onSave={(scores) => {
              const next = { ...yours, scores };
              if (own) setOwn(next);
              else setProfile(next);
              setPanel('scores');
            }}
            onRestart={() => setRestarting(true)}
            onClose={() => setPanel('none')}
          />
        )}
        {error && (
          <p className="error">
            {error}{' '}
            <button className="link" onClick={load}>
              Try again
            </button>
          </p>
        )}
        {!feed && !error && <p className="loading-line">Asking Qloo about your interests</p>}
        {feed && (
          <FeedView
            feed={feed}
            filling={filling}
            mode={mode}
            profile={profile}
            onRate={viewing ? undefined : () => setPanel('rate')}
            onRemove={(id) => setPosts((list) => list.filter((p) => p.id !== id))}
          />
        )}
      </main>
    </div>
  );
}
