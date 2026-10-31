import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createAgent } from '../server/agent';
import { createQloo } from '../server/qloo';
import { createGenerate } from '../server/vertex';
import type { AgentResult, Post } from '../shared/model';
import { SEEDS } from './seed-data';

const qloo = createQloo({ apiKey: process.env.QLOO_API_KEY });
const agent = createAgent({
  generate: createGenerate({
    project: process.env.VERTEX_LLM_PROJECT_ID,
    serviceAccount: process.env.VERTEX_LLM_SERVICE_ACCOUNT,
    location: process.env.VERTEX_LLM_REGION,
  }),
  allCritical: true,
  qloo,
});

const output = 'data/posts.json';
const done = new Map<string, Post>(
  existsSync(output) && !process.argv.includes('--fresh')
    ? (JSON.parse(readFileSync(output, 'utf8')) as Post[]).map((p) => [p.text, p])
    : [],
);
const agrees = (seed: (typeof SEEDS)[number], post?: Post) =>
  post?.position != null && (seed.side === 'low' ? post.position < 50 : post.position > 50);
const base = Date.parse('2026-10-30T12:00:00Z');
const queue = SEEDS.map((seed, index) => ({ seed, index })).filter((s) => !done.has(s.seed.text));
const failures: string[] = [];

async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;
    const { seed, index } = job;
    let result: AgentResult | undefined;
    for (let attempt = 0; attempt < 3 && !result; attempt++) {
      try {
        result = await agent.run(seed.text, {
          author: seed.author,
          source: 'seed',
          id: `seed-${String(index + 1).padStart(2, '0')}`,
          createdAt: new Date(base - index * 47 * 60_000).toISOString(),
        });
      } catch (error) {
        console.log(`retry ${seed.author}: ${String(error).slice(0, 100)}`);
      }
    }
    if (!result) {
      failures.push(seed.author);
      continue;
    }
    done.set(seed.text, result.post);
    const p = result.post;
    const agreed = agrees(seed, p);
    console.log(
      `${agreed ? 'ok  ' : 'DIFF'} ${seed.author.padEnd(10)} ${String(p.topic).padEnd(17)} ${String(p.position).padStart(3)} ${p.confidence.toFixed(2)} t${result.turns} [${p.entities.map((e) => e.name).join(' | ')}]${p.unresolved.length ? ' dropped: ' + p.unresolved.map((u) => u.text).join(', ') : ''}`,
    );
    writeFileSync(
      output,
      JSON.stringify(
        SEEDS.flatMap((s) => (done.has(s.text) ? [done.get(s.text)!] : [])),
        null,
        1,
      ) + '\n',
    );
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

const posts = [...done.values()];
const mismatched = SEEDS.filter((s) => !agrees(s, done.get(s.text)));
console.log(
  `\n${posts.length}/${SEEDS.length} posts, ${posts.reduce((n, p) => n + p.entities.length, 0)} entities, ${posts.reduce((n, p) => n + p.unresolved.length, 0)} unresolved, ${mismatched.length} side mismatches, failures: ${failures.join(', ') || 'none'}`,
);
