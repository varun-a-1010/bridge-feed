import { z } from 'zod';
import type { Entity, EntityType, RankRow, Receipt } from '../shared/model';

export const QLOO_ORIGIN = 'https://hackathon.api.qloo.com';

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}

export type SearchHit = Entity & { description: string };
export type RankAnswer = { rows: RankRow[]; receipt: Receipt };

export interface Qloo {
  status: 'configured' | 'not-connected';
  search(query: string, type: EntityType): Promise<SearchHit[]>;
  /** Rank `candidateIds` for one interest alone. Only opaque entity IDs ever reach Qloo. */
  rank(interest: Entity, type: EntityType, candidateIds: string[]): Promise<RankAnswer>;
}

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown, length = 240) => (typeof v === 'string' ? v.slice(0, length) : '');
const uuid = z.string().uuid();

function parseHit(raw: unknown, type: EntityType): SearchHit | null {
  const r = record(raw);
  const p = record(r.properties);
  const types = Array.isArray(r.types) ? r.types : [];
  if (
    !uuid.safeParse(r.entity_id).success ||
    !text(r.name) ||
    ![...types, r.subtype].includes(`urn:entity:${type}`)
  )
    return null;
  const image = text(record(p.image).url, 300);
  return {
    id: String(r.entity_id).toUpperCase(),
    name: text(r.name, 200),
    type,
    description: text(p.short_description ?? p.description),
    ...(image.startsWith('https://images.qloo.com/') ? { image } : {}),
  };
}

export function createQloo(
  options: {
    apiKey?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    recorded?: Map<string, RankAnswer>;
  } = {},
): Qloo {
  const key = options.apiKey?.trim();
  const cache = new Map<string, { data: Record<string, unknown>; at: string; expires: number }>();

  async function get(path: string, params: Record<string, string>) {
    if (!key) throw new QlooError('Qloo is not connected.', 503);
    const url = new URL(path, QLOO_ORIGIN);
    url.search = new URLSearchParams(params).toString();
    const cached = cache.get(url.href);
    if (cached && cached.expires > Date.now()) return cached;
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      try {
        response = await (options.fetch ?? fetch)(url, {
          headers: { 'X-Api-Key': key, Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
        });
      } catch {
        throw new QlooError('Qloo could not be reached.');
      }
      if ((response.status !== 429 && response.status < 500) || attempt === 2) break;
      await new Promise((done) => setTimeout(done, 300 * 2 ** attempt + Math.random() * 200));
    }
    if (response.status === 429) throw new QlooError('Qloo is rate limited.', 503);
    if ([401, 403].includes(response.status))
      throw new QlooError('Qloo rejected the server credential.', 503);
    if (response.status === 404 && path === '/search')
      return { data: { results: [] }, at: new Date().toISOString() };
    if (!response.ok) throw new QlooError(`Qloo returned ${response.status}.`);
    let data: Record<string, unknown>;
    try {
      data = record(JSON.parse((await response.text()).slice(0, 2_000_000)));
    } catch {
      throw new QlooError('Qloo returned an invalid response.');
    }
    if (data.success === false || !('results' in data))
      throw new QlooError('Qloo returned an invalid response.');
    const value = { data, at: new Date().toISOString(), expires: Date.now() + 3_600_000 };
    if (cache.size >= 800) cache.delete(cache.keys().next().value!);
    cache.set(url.href, value);
    return value;
  }

  return {
    status: key ? 'configured' : 'not-connected',
    async search(query, type) {
      const { data } = await get('/search', {
        query: query.trim(),
        types: `urn:entity:${type}`,
        take: '5',
      });
      if (!Array.isArray(data.results)) throw new QlooError('Qloo returned an invalid result.');
      return data.results.map((r) => parseHit(r, type)).filter((e): e is SearchHit => e !== null);
    },
    async rank(interest, type, candidateIds) {
      const ids = [...new Set(candidateIds.map((id) => id.toUpperCase()))]
        .filter((id) => id !== interest.id)
        .sort();
      const recorded = options.recorded?.get(rankKey(interest.id, type, ids));
      if (recorded) return recorded;
      if (ids.length < 2)
        return {
          rows: [],
          receipt: {
            interest: interest.name,
            type,
            candidates: ids.length,
            returned: 0,
            source: 'live',
            retrievedAt: new Date().toISOString(),
          },
        };
      const { data, at } = await get('/v2/insights', {
        'filter.type': `urn:entity:${type}`,
        'signal.interests.entities': interest.id,
        'filter.results.entities': ids.join(','),
        take: String(Math.min(ids.length, 50)),
      });
      const rows = record(data.results).entities;
      if (!Array.isArray(rows)) throw new QlooError('Qloo returned an invalid ranking.');
      const scored = rows.flatMap((raw) => {
        const r = record(raw);
        const id = text(r.entity_id).toUpperCase();
        const affinity = record(r.query).affinity;
        return ids.includes(id) && typeof affinity === 'number' && Number.isFinite(affinity)
          ? [{ id, affinity }]
          : [];
      });
      scored.sort((a, b) => b.affinity - a.affinity || a.id.localeCompare(b.id));
      return {
        rows: scored.map((row) => ({
          interestId: interest.id,
          type,
          entityId: row.id,
          rank: 1 + scored.filter((other) => other.affinity > row.affinity).length,
          of: scored.length,
        })),
        receipt: {
          interest: interest.name,
          type,
          candidates: ids.length,
          returned: scored.length,
          source: 'live',
          retrievedAt: at,
        },
      };
    },
  };
}

export const rankKey = (interestId: string, type: EntityType, ids: string[]) =>
  `${interestId}|${type}|${[...ids].sort().join(',')}`;
