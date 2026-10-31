import { z } from 'zod';
import { MIN_CANDIDATES, candidateCutoff } from '../shared/feed';
import { TYPE_LABELS, type Entity, type RankRow } from '../shared/model';
import { MODEL_CHAINS, thinkingFor, withFallback } from './models';
import type { Qloo } from './qloo';
import type { Generate } from './vertex';

export type Link = { ok: boolean; reason: string };
export const linkKey = (interestId: string, entityId: string) => `${interestId}|${entityId}`;

const BATCH = 10;
/** A reader with interests outside the catalog needs enough reviewed links to fill a feed. */
const MAX_LIVE_PAIRS = 40;
/** Each batch is a model call, so live review has a daily ceiling, as the agent does. */
const MAX_DAILY_PAIRS = 6000;

const system = `You review proposed connections for a social feed. Each pair is something a reader likes and something mentioned in a stranger's post. A taste graph ranked the second item highly for the first, which is only a statistical signal.

Decide whether a thoughtful person, shown the two side by side, would recognise a real connection. Approve only when they share something specific: a subject, world, tone, sensibility, era, craft or sound. Knicks and Hoop Dreams share basketball. Boardwalk Empire and Rounders share a world of crime, risk and antiheroes.

Reject when the only link is a shared audience, a broad genre label, popularity, or coincidence. A rock band and a piece of design software do not connect because similar people use them. Reject obvious containment too, where one is simply part of the other, such as a team and its league or a brand and its own product: that teaches a reader nothing. When in doubt, reject. A bad link is far worse than a missing one.

For an approved pair, write one short plain sentence, at most 14 words, on what they actually share. Speak about the works, never about their fans. Never mention anyone's beliefs, politics or identity. Say what they share in spirit or subject. Do not cite trivia such as a particular song, scene or collaboration, because a wrong detail destroys trust.

Tags are noisy hints taken from the taste graph. Ignore any that do not fit.`;

const verdicts = z.object({
  verdicts: z.array(
    z.object({ id: z.number().int(), ok: z.boolean(), reason: z.string().max(200).default('') }),
  ),
});
const verdictSchema = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          ok: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['id', 'ok', 'reason'],
      },
    },
  },
  required: ['verdicts'],
};

export type LinkPair = { interest: Entity; entity: Entity };

/** Gemini can only remove a link Qloo found. It never adds one, and unchecked links stay out. */
export function createLinker(options: {
  generate?: Generate;
  qloo?: Qloo;
  tags?: Map<string, string[]>;
  links?: Map<string, Link>;
  critical?: boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  dailyPairs?: number;
}) {
  const known = new Map(options.links ?? []);
  const tags = new Map(options.tags ?? []);
  const now = options.now ?? (() => new Date());
  const dailyPairs = options.dailyPairs ?? MAX_DAILY_PAIRS;
  let day = '';
  let spent = 0;

  async function tagsFor(id: string) {
    if (!tags.has(id)) tags.set(id, (await options.qloo?.tags(id).catch(() => [])) ?? []);
    return tags.get(id)!;
  }

  async function judgeBatch(pairs: LinkPair[]) {
    const generate = options.generate;
    if (!generate) return;
    const rows = await Promise.all(
      pairs.map(async ({ interest, entity }, id) => ({
        id,
        likes: { name: interest.name, kind: TYPE_LABELS[interest.type].one },
        mentioned: { name: entity.name, kind: TYPE_LABELS[entity.type].one },
        hint_tags: {
          likes: (await tagsFor(interest.id)).slice(0, 25),
          mentioned: (await tagsFor(entity.id)).slice(0, 25),
        },
      })),
    );
    const { value } = await withFallback(
      options.critical ? MODEL_CHAINS.critical : MODEL_CHAINS.routine,
      async (model, timeoutMs) => {
        const response = await generate({
          model,
          contents: JSON.stringify(rows),
          config: {
            systemInstruction: system,
            maxOutputTokens: 6000,
            ...thinkingFor(model),
            responseMimeType: 'application/json',
            responseJsonSchema: verdictSchema,
            abortSignal: AbortSignal.timeout(timeoutMs),
          },
        });
        return verdicts.parse(JSON.parse(response.text ?? ''));
      },
      { sleep: options.sleep, timeoutMs: options.critical ? 60_000 : 20_000, passes: 2 },
    );
    for (const verdict of value.verdicts) {
      const pair = pairs[verdict.id];
      if (pair)
        known.set(linkKey(pair.interest.id, pair.entity.id), {
          ok: verdict.ok && verdict.reason.trim().length > 0,
          reason: verdict.reason.trim(),
        });
    }
  }

  async function judge(pairs: LinkPair[]) {
    const open = pairs.filter((p) => !known.has(linkKey(p.interest.id, p.entity.id)));
    const batches = Array.from({ length: Math.ceil(open.length / BATCH) }, (_, index) =>
      open.slice(index * BATCH, (index + 1) * BATCH),
    );
    await Promise.all(batches.map((batch) => judgeBatch(batch).catch(() => undefined)));
  }

  return {
    judge,
    reason: (interestId: string, entityId: string) =>
      known.get(linkKey(interestId, entityId))?.reason || undefined,
    get: (interestId: string, entityId: string) => known.get(linkKey(interestId, entityId)),
    entries: () => [...known],
    /** Keeps only ranked rows a person would accept. Anything that cannot be checked is dropped. */
    async approve(rows: RankRow[], entities: Entity[], interests: Entity[]) {
      const entityById = new Map(entities.map((e) => [e.id, e]));
      const interestById = new Map(interests.map((i) => [i.id, i]));
      const eligible = rows.filter(
        (row) =>
          row.of >= MIN_CANDIDATES &&
          row.rank <= candidateCutoff(row.of) &&
          entityById.has(row.entityId) &&
          interestById.has(row.interestId),
      );
      const today = now().toISOString().slice(0, 10);
      if (today !== day) {
        day = today;
        spent = 0;
      }
      const pending = eligible
        .filter((row) => !known.has(linkKey(row.interestId, row.entityId)))
        .sort((a, b) => a.rank / a.of - b.rank / b.of)
        .slice(0, Math.min(MAX_LIVE_PAIRS, dailyPairs - spent));
      spent += pending.length;
      await judge(
        pending.map((row) => ({
          interest: interestById.get(row.interestId)!,
          entity: entityById.get(row.entityId)!,
        })),
      );
      return eligible.filter((row) => known.get(linkKey(row.interestId, row.entityId))?.ok);
    },
    unchecked: (rows: RankRow[]) =>
      rows.filter((row) => !known.has(linkKey(row.interestId, row.entityId))).length,
  };
}

export type Linker = ReturnType<typeof createLinker>;
