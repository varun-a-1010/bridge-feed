import { writeFileSync } from 'node:fs';
import { loadCorpus } from '../server/corpus';
import { computeFeed } from '../server/feed';
import { createQloo } from '../server/qloo';
import { literalMatches } from '../shared/feed';
import { TOPICS, type Profile, type Topic } from '../shared/model';

/** Replays recorded Qloo rankings for simulated readers. It measures the ranker, not people. */
const corpus = loadCorpus();
const qloo = createQloo({ recorded: corpus.recorded });
let state = 20261030;
const random = () => {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
};
const pick = <T>(list: readonly T[], count: number) =>
  [...list]
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count)
    .map((row) => row.item);

const READERS = 200;
const reached = new Set<string>();
let bridges = 0;
let qlooOnly = 0;
let withBridge = 0;
let literalOnly = 0;
let qualified = 0;
let opposing = 0;
let failed = 0;
for (let i = 0; i < READERS; i++) {
  const stances: Profile['stances'] = {};
  for (const topic of pick(TOPICS, 4)) stances[topic.id as Topic] = pick(topic.stances, 1)[0]!.id;
  const profile: Profile = { stances, interests: pick(corpus.interests, 4) };
  const feed = await computeFeed(qloo, corpus, profile, []);
  failed += feed.failedQueries;
  bridges += feed.stats.shown;
  qlooOnly += feed.stats.qlooOnly;
  qualified += feed.stats.qualified;
  opposing += feed.stats.opposing;
  if (feed.stats.shown) withBridge++;
  feed.bridge.filter((b) => b.kind === 'bridge').forEach((b) => reached.add(b.post.id));
  literalOnly += corpus.posts.filter((post) => {
    const stance = post.topic ? stances[post.topic as Topic] : undefined;
    return stance && post.viewpoint !== stance && literalMatches(post, profile).length > 0;
  }).length;
}
const percent = (a: number, b: number) => `${((100 * a) / b).toFixed(1)}%`;
const entities = corpus.posts.reduce((n, p) => n + p.entities.length, 0);
const report = `---
type: Evidence
title: Ranker evaluation
description: Reproducible replay of recorded Qloo rankings for simulated readers.
timestamp: ${new Date().toISOString().slice(0, 10)}
---

Run \`npm run evaluate\`. ${READERS} simulated readers, each with four random stances and four
random catalog interests, replayed against recorded Qloo rankings. This measures how the ranker
behaves. It says nothing about how real people respond.

The catalog was deliberately chosen to be mostly absent from the sample posts, so that bridges
have to be earned. The literal-match figure is therefore a property of this corpus, not a general
finding. A reader who searches for a title that a post names will see literal overlap, and that
overlap still cannot create a bridge on its own.

| Measure | Result |
|---|---|
| Sample posts through the live agent | ${corpus.posts.length} |
| Posts with at least one Qloo entity | ${corpus.posts.filter((p) => p.entities.length).length} of ${corpus.posts.length} |
| Confirmed Qloo entities | ${entities} |
| References left unresolved | ${corpus.posts.reduce((n, p) => n + p.unresolved.length, 0)} |
| Recorded Qloo rankings | ${corpus.recorded.size} |
| Readers with at least one bridge | ${percent(withBridge, READERS)} |
| Bridges per reader | ${(bridges / READERS).toFixed(2)} |
| Opposing posts that cleared the cutoff | ${percent(qualified, opposing)} |
| Bridges sharing no title with the reader's interests | ${percent(qlooOnly, bridges)} |
| Opposing posts literal matching alone would find, per reader | ${(literalOnly / READERS).toFixed(2)} |
| Distinct posts reached across all readers | ${reached.size} of ${corpus.posts.length} |
| Failed Qloo queries during the replay | ${failed} |
`;
writeFileSync('docs/evidence/evaluation.md', report);
console.log(
  report
    .split('\n')
    .filter((l) => l.startsWith('|'))
    .join('\n'),
);
