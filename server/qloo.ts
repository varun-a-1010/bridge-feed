import { z } from 'zod';
import {
  ENTITY_TYPES,
  type Entity,
  type EntityType,
  type RankRow,
  type Receipt,
} from '../shared/model';

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
  /** One search across every supported type, for a reader typing a name. */
  searchAll(query: string): Promise<SearchHit[]>;
  /** Descriptive taste tags for one entity. Hints for the link check, never shown to readers. */
  tags(entityId: string): Promise<string[]>;
  /** Rank `candidateIds` for one interest alone. Only opaque entity IDs ever reach Qloo. */
  rank(interest: Entity, type: EntityType, candidateIds: string[]): Promise<RankAnswer>;
}

const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const text = (v: unknown, length = 240) => (typeof v === 'string' ? v.slice(0, length) : '');
const uuid = z.string().uuid();

const TAG_KINDS =
  /^urn:tag:(keyword|genre|subgenre|style|theme|aesthetic_property|emotional_tone|motif|archetype|plot|lifestyle|characteristic|adjective)/;
/** Identity and broad labels say nothing about what two works share, so they never reach the check. */
const TAG_NOISE =
  /^(gay|lesbian|homosexual|lgbt|queer|transgender|bisexual|women|woman|men|man|female|male|black|white|asian|african american|jewish|christian|muslim|religion|politics|political|sex|nudity|entertainment|novels?|fiction|nonfiction|non-fiction|books?|music|film|movies?|tv|television|contemporary|classics?|literature|bar|restaurant|popular|modern|american|british|english|family|friend|friendship|love|romance|drama|comedy|female protagonist|male protagonist|based on novel or book|based on a book|independent film)$/i;

export const usefulTags = (tags: { id: string; name: string }[]) => [
  ...new Set(
    tags
      .filter((t) => TAG_KINDS.test(t.id) && t.name.trim().length > 2)
      .map((t) => t.name.trim())
      .filter((name) => !TAG_NOISE.test(name)),
  ),
];

const typesOf = (raw: Record<string, unknown>) => [
  ...(Array.isArray(raw.types) ? raw.types : []),
  raw.subtype,
];

function parseHit(raw: unknown, type: EntityType): SearchHit | null {
  const r = record(raw);
  const p = record(r.properties);
  if (
    !uuid.safeParse(r.entity_id).success ||
    !text(r.name) ||
    !typesOf(r).includes(`urn:entity:${type}`)
  )
    return null;
  const image = text(record(p.image).url, 300);
  const year = Number(p.release_year ?? p.publication_year);
  return {
    id: String(r.entity_id).toUpperCase(),
    name: text(r.name, 200),
    type,
    description: text(p.short_description ?? p.description),
    ...(image.startsWith('https://images.qloo.com/') ? { image } : {}),
    ...(Number.isInteger(year) && year >= 1000 && year <= 3000 ? { year } : {}),
  };
}

export function createQloo(
  options: {
    apiKey?: string;
    fetch?: typeof fetch;
    timeoutMs?: number;
    paceMs?: number;
    retryMs?: number;
    recorded?: Map<string, RankAnswer>;
  } = {},
): Qloo {
  const key = options.apiKey?.trim();
  const cache = new Map<string, { data: Record<string, unknown>; at: string; expires: number }>();
  // Qloo lets about ten requests through at once, so every caller shares one steady pace.
  const gapMs = options.paceMs ?? 110;
  let nextStart = 0;
  const pace = async () => {
    const now = Date.now();
    const start = Math.max(now, nextStart);
    nextStart = start + gapMs;
    if (start > now) await new Promise((done) => setTimeout(done, start - now));
  };

  async function get(path: string, params: Record<string, string>) {
    if (!key) throw new QlooError('Qloo is not connected.', 503);
    const url = new URL(path, QLOO_ORIGIN);
    url.search = new URLSearchParams(params).toString();
    const cached = cache.get(url.href);
    if (cached && cached.expires > Date.now()) return cached;
    let response: Response;
    for (let attempt = 0; ; attempt++) {
      await pace();
      try {
        response = await (options.fetch ?? fetch)(url, {
          headers: { 'X-Api-Key': key, Accept: 'application/json' },
          redirect: 'error',
          signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
        });
      } catch {
        throw new QlooError('Qloo could not be reached.');
      }
      if ((response.status !== 429 && response.status < 500) || attempt === 3) break;
      await new Promise((done) =>
        setTimeout(done, (options.retryMs ?? 400) * 2 ** attempt + Math.random() * 200),
      );
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
    async tags(entityId) {
      const { data } = await get('/v2/insights', {
        'filter.type': 'urn:tag',
        'signal.interests.entities': entityId,
        take: '50',
      });
      const results = record(data.results);
      const rows = Array.isArray(results.tags) ? results.tags : results.entities;
      if (!Array.isArray(rows)) throw new QlooError('Qloo returned invalid tags.');
      return usefulTags(
        rows.map((raw) => {
          const r = record(raw);
          return { id: text(r.tag_id ?? r.id, 200), name: text(r.name, 80) };
        }),
      );
    },
    async searchAll(query) {
      const { data } = await get('/search', {
        query: query.trim(),
        types: ENTITY_TYPES.map((type) => `urn:entity:${type}`).join(','),
        take: '10',
      });
      if (!Array.isArray(data.results)) throw new QlooError('Qloo returned an invalid result.');
      return data.results.flatMap((raw) => {
        const r = record(raw);
        const type = ENTITY_TYPES.find((t) => typesOf(r).includes(`urn:entity:${t}`));
        const hit = type && parseHit(raw, type);
        return hit ? [hit] : [];
      });
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
