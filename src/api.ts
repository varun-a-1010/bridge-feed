import type {
  AgentResult,
  AgentStep,
  CatalogItem,
  Entity,
  EntityType,
  FeedResponse,
  Post,
  Preset,
  Profile,
} from '../shared/model';

export type Bootstrap = {
  interests: CatalogItem[];
  presets: Preset[];
  posts: number;
  entities: number;
  connected: { qloo: boolean; agent: boolean };
};
export type Feed = FeedResponse & { failedQueries: number };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? 'The server could not answer. Try again.');
  return body as T;
}

export const getBootstrap = () => request<Bootstrap>('/api/bootstrap');

export const searchEntities = (q: string, type: EntityType) =>
  request<{ results: Entity[] }>(`/api/search?${new URLSearchParams({ q, type }).toString()}`).then(
    (r) => r.results,
  );

export const getFeed = (profile: Profile, posts: Post[]) =>
  request<Feed>('/api/feed', { method: 'POST', body: JSON.stringify({ profile, posts }) });

export async function analyze(text: string, onStep: (step: AgentStep) => void) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? 'The agent could not start. Try again.');
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let result: AgentResult | undefined;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line);
      if (event.type === 'step') onStep(event.step);
      if (event.type === 'result') result = event.result;
      if (event.type === 'error') throw new Error(event.message);
    }
  }
  if (!result) throw new Error('The agent stopped before finishing. Try again.');
  return result;
}

const key = 'bridge-feed:v2';
export type Saved = { profile?: Profile; baseline?: Profile['scores']; posts?: Post[] };

export function loadSaved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}') as Saved;
  } catch {
    return {};
  }
}

export function save(value: Saved) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private windows can block storage. The session still works without it.
  }
}
