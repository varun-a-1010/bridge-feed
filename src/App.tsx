import { useCallback, useEffect, useMemo, useState } from 'react';
import { PenLine, SlidersHorizontal } from 'lucide-react';
import type { Post, Preset, Profile } from '../shared/model';
import { getBootstrap, getFeed, loadSaved, save, type Bootstrap, type Feed } from './api';
import { Compose } from './Compose';
import { FeedView } from './Feed';
import { Onboarding } from './Onboarding';

export function App() {
  const saved = useMemo(loadSaved, []);
  const [bootstrap, setBootstrap] = useState<Bootstrap>();
  const [profile, setProfile] = useState<Profile | undefined>(saved.profile);
  const [posts, setPosts] = useState<Post[]>(saved.posts ?? []);
  const [feed, setFeed] = useState<Feed>();
  const [mode, setMode] = useState<'typical' | 'bridge'>('typical');
  const [viewing, setViewing] = useState<string>();
  const [own, setOwn] = useState<Profile>();
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);
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
    getFeed(profile, viewing ? posts.map((p) => ({ ...p, source: 'peer' as const })) : posts)
      .then(setFeed)
      .catch((e: Error) => setError(e.message));
  }, [profile, posts, viewing]);

  useEffect(load, [load]);
  useEffect(() => save({ profile: own ?? profile, posts }), [own, profile, posts]);

  const choose = (next: Profile) => {
    setProfile(next);
    setOwn(undefined);
    setViewing(undefined);
    setEditing(false);
    setMode('typical');
  };
  const viewAs = (preset: Preset) => {
    setOwn((current) => current ?? profile);
    setProfile({ stances: preset.stances, interests: preset.interests });
    setViewing(preset.name);
    setComposing(false);
    setMode('bridge');
  };

  if (!bootstrap)
    return (
      <div className="loading">
        {error ? <p className="error">{error}</p> : <p>Opening the feed</p>}
      </div>
    );
  if (!profile || editing)
    return <Onboarding bootstrap={bootstrap} initial={profile} onDone={choose} />;

  return (
    <div className={`shell shell-${mode}`}>
      <header className="topbar">
        <h1 className="wordmark">Bridge Feed</h1>
        <div className="mode" role="group" aria-label="Feed type">
          <button aria-pressed={mode === 'typical'} onClick={() => setMode('typical')}>
            Typical feed
          </button>
          <button aria-pressed={mode === 'bridge'} onClick={() => setMode('bridge')}>
            Bridge feed
          </button>
        </div>
        <div className="tools">
          <button className="quiet" onClick={() => setComposing(!composing)}>
            <PenLine size={15} aria-hidden /> Write
          </button>
          <button className="quiet" onClick={() => setEditing(true)}>
            <SlidersHorizontal size={15} aria-hidden /> Change views
          </button>
        </div>
      </header>

      <main className="stage">
        {viewing && (
          <p className="viewing">
            You are viewing this as {viewing}, a sample reader.{' '}
            <button className="link" onClick={() => own && choose(own)}>
              Go back to your own views
            </button>
          </p>
        )}
        {composing && (
          <Compose
            connected={bootstrap.connected.agent}
            presets={bootstrap.presets}
            onPublish={(post) => setPosts((list) => [post, ...list].slice(0, 8))}
            onViewAs={viewAs}
            onClose={() => setComposing(false)}
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
        {feed && <FeedView feed={feed} mode={mode} profile={profile} />}
      </main>
    </div>
  );
}
