# Bridge Feed

Qloo hackathon project: a prototype of a social platform built against the filter bubble. It
shows opposing views, reached through cultural affinity people already share. Work on `main`. Do not touch other repos from here.

- Follow `~/code/AGENTS.md`. No unsolicited browser or visual QA.
- `npm run check` runs formatting, tests, type checking and production build.
- Scores come only from what a reader chooses and from the text of a post. Qloo receives opaque
  entity IDs and nothing else. Never infer beliefs from taste, or imply Qloo did.
- Rating again counts movement in either direction, and no change is a valid answer. Never treat
  moving toward the other side as success.
- Tailor the catalog and posts to the audience, but never name, profile or assign views to a real
  person in the app, repo or docs.
- A bridge is earned only from a Qloo ranking of an entity the reader did not select. A literal
  match can never qualify a post on its own.
- Original posts are never rewritten. Sample posts are fictional and labelled, with no invented
  engagement counts.
- This is a prototype of the feed at the heart of a future platform. Do not describe profiles,
  follows or other platform features as if they exist.
- Never claim reduced polarization or any effect on real people. The evaluation measures the
  ranker with simulated readers.
- Secrets stay server-side in Doppler project `qloo`. Ship with
  `~/code/dev-env/bin/qloo-ship bridge-feed`. The standard is `~/code/qloo-submissions.md`.

## Docs

Read `docs/index.md` and `.context-map.json`. Update affected Reference docs and `docs/log.md`
in the same change.
