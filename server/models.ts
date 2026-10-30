import { ThinkingLevel } from '@google/genai';

/** Argon decides what matters. The Flash models keep routine turns fast and catch its failures. */
export const MODEL_CHAINS = {
  critical: [
    'gemini-4-argon',
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
  ],
  routine: [
    'gemini-3.5-flash-lite',
    'gemini-3-flash-preview',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
  ],
} as const;

const TIMEOUT_MS: Record<string, number> = { 'gemini-4-argon': 15_000 };
const DEFAULT_TIMEOUT_MS = 10_000;

export const MODEL_NAMES: Record<string, string> = {
  'gemini-4-argon': 'Gemini 4 Argon',
  'gemini-3.5-flash-lite': 'Gemini 3.5 Flash Lite',
  'gemini-3-flash-preview': 'Gemini 3 Flash',
  'gemini-3.8-flash': 'Gemini 3.8 Flash',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
};

export const thinkingFor = (model: string) =>
  model === 'gemini-2.5-flash' ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };

export type FallbackOptions = {
  /** Models that already failed in this run are tried last, not first. */
  failed?: Set<string>;
  passes?: number;
  deadlineMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onFailure?: (model: string, error: unknown) => void;
  onBackoff?: (ms: number) => void;
};

/**
 * Walk the chain until a model answers. A rate limit on one model must never end a run, so a
 * pass where every model fails backs off and walks the whole chain again, within a deadline.
 */
export async function withFallback<T>(
  chain: readonly string[],
  attempt: (model: string, timeoutMs: number) => Promise<T>,
  options: FallbackOptions = {},
): Promise<{ value: T; model: string }> {
  const failed = options.failed ?? new Set<string>();
  const passes = options.passes ?? 4;
  const started = Date.now();
  const deadline = options.deadlineMs ?? 60_000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  let lastError: unknown = new Error('No model available.');
  for (let pass = 0; pass < passes; pass++) {
    const order = [...chain].sort((a, b) => Number(failed.has(a)) - Number(failed.has(b)));
    for (const model of order) {
      const remaining = deadline - (Date.now() - started);
      if (remaining <= 0) throw lastError;
      try {
        const timeout = Math.min(TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS, remaining);
        const value = await attempt(model, timeout);
        failed.delete(model);
        return { value, model };
      } catch (error) {
        lastError = error;
        failed.add(model);
        options.onFailure?.(model, error);
      }
    }
    if (pass < passes - 1) {
      const wait = 1_500 * 2 ** pass + Math.random() * 400;
      options.onBackoff?.(wait);
      await sleep(wait);
    }
  }
  throw lastError;
}
