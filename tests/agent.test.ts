import { describe, expect, it, vi } from 'vitest';
import type { GenerateContentResponse } from '@google/genai';
import { AgentUnavailable, createAgent } from '../server/agent';
import type { Qloo } from '../server/qloo';
import type { AgentStep, Preset } from '../shared/model';

const ID = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
const call = (name: string, args: Record<string, unknown> = {}) => ({ name, args, id: name });
const reply = (...calls: ReturnType<typeof call>[]) =>
  ({
    candidates: [{ content: { role: 'model', parts: [] }, finishReason: 'STOP' }],
    functionCalls: calls,
  }) as unknown as GenerateContentResponse;
const analysis = (over: Record<string, unknown> = {}) =>
  call('record_analysis', {
    safety: 'publish',
    topic: 'smart_tech',
    viewpoint: 'privacy_first',
    confidence: 0.9,
    ambiguous: false,
    language: 'en',
    references: ['Black Mirror'],
    ...over,
  });
const qloo = (): Qloo => ({
  status: 'configured',
  search: vi.fn(async () => [
    { id: ID, name: 'Black Mirror', type: 'tv_show' as const, description: '' },
  ]),
  rank: vi.fn(async (interest) => ({
    rows: [{ interestId: interest.id, type: 'tv_show' as const, entityId: ID, rank: 1, of: 30 }],
    receipt: {
      interest: interest.name,
      type: 'tv_show' as const,
      candidates: 30,
      returned: 30,
      source: 'live' as const,
      retrievedAt: 'now',
    },
  })),
});
const POST = 'Black Mirror made me unplug the speaker in our bedroom.';
const script = (...turns: GenerateContentResponse[]) => {
  const generate = vi.fn();
  turns.forEach((t) => generate.mockResolvedValueOnce(t));
  return generate;
};
const searchCall = call('search_qloo', {
  reference: 'Black Mirror',
  query: 'Black Mirror',
  type: 'tv_show',
});
const linkCall = call('link_reference', {
  reference: 'Black Mirror',
  entity_id: ID,
  reason: 'exact',
});
const noWait = async () => {};

describe('intake agent', () => {
  it('runs the full loop and keeps the original text', async () => {
    const generate = script(
      reply(analysis()),
      reply(searchCall),
      reply(linkCall),
      reply(call('finish', { summary: 'done' })),
    );
    const steps: AgentStep[] = [];
    const agent = createAgent({ generate, qloo: qloo() });
    const result = await agent.run(POST, { onStep: (s) => steps.push(s) });
    expect(result.status).toBe('bridge_ready');
    expect(result.post.text).toBe(POST);
    expect(result.post.entities).toMatchObject([{ id: ID, surface: 'Black Mirror' }]);
    expect(steps.map((s) => s.kind)).toEqual(['read', 'search', 'link', 'finish']);
  });

  it('stops at a safety hold before any Qloo call', async () => {
    const provider = qloo();
    const generate = script(reply(analysis({ safety: 'reject', safety_reason: 'threat' })));
    const result = await createAgent({ generate, qloo: provider }).run(POST);
    expect(result.status).toBe('held');
    expect(provider.search).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('refuses a reference that is not in the post and an entity it never searched', async () => {
    const provider = qloo();
    const generate = script(
      reply(analysis({ references: [] })),
      reply(
        call('search_qloo', { reference: 'Taylor Swift', query: 'Taylor Swift', type: 'artist' }),
      ),
      reply(call('link_reference', { reference: 'Black Mirror', entity_id: ID, reason: 'guess' })),
      reply(call('finish', { summary: 'done' })),
    );
    const result = await createAgent({ generate, qloo: provider }).run(POST);
    expect(provider.search).not.toHaveBeenCalled();
    expect(result.post.entities).toEqual([]);
    expect(result.status).toBe('topic_only');
  });

  it('will not finish while a reference is unresolved', async () => {
    const generate = script(
      reply(analysis()),
      reply(call('finish', { summary: 'early' })),
      reply(call('drop_reference', { reference: 'Black Mirror', reason: 'unsure' })),
      reply(call('finish', { summary: 'done' })),
    );
    const result = await createAgent({ generate, qloo: qloo() }).run(POST);
    expect(generate).toHaveBeenCalledTimes(4);
    expect(result.post.unresolved).toEqual([{ text: 'Black Mirror', reason: 'unsure' }]);
    expect(result.status).toBe('topic_only');
  });

  it('caps ambiguous confidence below the bridge bar even with entities', async () => {
    const generate = script(
      reply(analysis({ ambiguous: true, confidence: 0.95 })),
      reply(searchCall),
      reply(linkCall),
      reply(call('finish', {})),
    );
    const result = await createAgent({ generate, qloo: qloo() }).run(POST);
    expect(result.post.confidence).toBeLessThan(0.7);
    expect(result.status).toBe('topic_only');
  });

  it('enforces the turn budget and records what was left open', async () => {
    const generate = vi.fn(async () => reply(call('unknown_tool')));
    generate.mockResolvedValueOnce(reply(analysis()));
    const result = await createAgent({ generate, qloo: qloo() }).run(POST);
    expect(generate).toHaveBeenCalledTimes(10);
    expect(result.post.unresolved[0]?.text).toBe('Black Mirror');
  });

  it('survives Qloo failing mid-run with no invented metadata', async () => {
    const provider = qloo();
    provider.search = vi.fn(async () => {
      throw new Error('down');
    });
    const generate = script(
      reply(analysis()),
      reply(searchCall),
      reply(call('drop_reference', { reference: 'Black Mirror', reason: 'unavailable' })),
      reply(call('finish', {})),
    );
    const result = await createAgent({ generate, qloo: provider }).run(POST);
    expect(result.post.entities).toEqual([]);
    expect(result.status).toBe('topic_only');
  });

  it('uses Argon first on the critical turn and Flash on routine turns', async () => {
    const generate = script(reply(analysis({ references: [] })), reply(call('finish', {})));
    await createAgent({ generate, qloo: qloo() }).run(POST);
    expect(generate.mock.calls.map((c) => c[0].model)).toEqual([
      'gemini-4-argon',
      'gemini-3.5-flash-lite',
    ]);
  });

  it('keeps going when the lead model is rate limited', async () => {
    const generate = vi.fn(async (request: { model: string }) => {
      if (request.model === 'gemini-4-argon') throw new Error('429');
      return generate.mock.calls.length <= 2
        ? reply(analysis({ references: [] }))
        : reply(call('finish', {}));
    });
    const result = await createAgent({ generate, qloo: qloo(), sleep: noWait }).run(POST);
    expect(result.status).toBe('topic_only');
    expect(generate.mock.calls[1]![0].model).toBe('gemini-3.5-flash-lite');
  });

  it('reports failure only when no model can answer, and never publishes then', async () => {
    const generate = vi.fn(async () => {
      throw new Error('429');
    });
    await expect(
      createAgent({ generate, qloo: qloo(), sleep: noWait }).run(POST),
    ).rejects.toBeInstanceOf(AgentUnavailable);
  });

  it('tests reach against opposing readers using Qloo rank only', async () => {
    const reader: Preset = {
      id: 'theo',
      name: 'Theo',
      blurb: '',
      stances: { smart_tech: 'smart_convenience' },
      interests: [{ id: 'B', name: 'Ted Lasso', type: 'tv_show' }],
    };
    const same: Preset = {
      ...reader,
      id: 'ines',
      name: 'Ines',
      stances: { smart_tech: 'privacy_first' },
    };
    const generate = script(
      reply(analysis()),
      reply(searchCall),
      reply(linkCall),
      reply(call('test_reach')),
      reply(call('finish', {})),
    );
    const agent = createAgent({
      generate,
      qloo: qloo(),
      audiences: [reader, same],
      corpus: () => [ID],
    });
    const { reach } = await agent.run(POST);
    expect(reach).toMatchObject([
      { audience: 'Theo', outcome: 'bridge', evidence: { interest: 'Ted Lasso', rank: 1, of: 30 } },
      { audience: 'Ines', outcome: 'same_side' },
    ]);
  });

  it('holds a post the model refuses to process', async () => {
    const generate = script({
      promptFeedback: { blockReason: 'SAFETY' },
      candidates: [],
    } as unknown as GenerateContentResponse);
    const result = await createAgent({ generate, qloo: qloo() }).run(POST);
    expect(result.status).toBe('held');
  });
});
