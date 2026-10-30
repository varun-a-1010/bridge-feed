# Bridge Feed

Qloo hackathon project: a social feed prototype that uses cultural affinity to reach a
differing viewpoint. Work on `main`. Do not touch other repos from here.

- Follow `~/code/AGENTS.md`. No unsolicited browser or visual QA.
- `npm run check` runs formatting, tests, type checking and production build.
- Viewpoints come only from explicit selections and the text of a post. Qloo receives opaque
  entity IDs and nothing else. Never infer beliefs from taste, or imply Qloo did.
- A bridge is earned only from a Qloo ranking of an entity the reader did not select. A literal
  match can never qualify a post on its own.
- Original posts are never rewritten. Sample posts are fictional and labelled, with no invented
  engagement counts.
- Never claim reduced polarization or any effect on real people. The evaluation measures the
  ranker with simulated readers.
- Secrets stay server-side in Doppler project `qloo`. Ship with
  `~/code/dev-env/bin/qloo-ship bridge-feed`. The standard is `~/code/qloo-submissions.md`.

## Docs

Read `docs/index.md` and `.context-map.json`. Update affected Reference docs and `docs/log.md`
in the same change.
