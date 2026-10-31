---
type: Reference
title: Intake agent
description: The Gemini tool loop that prepares a post, and what the server enforces around it.
timestamp: 2026-10-31
last_verified: 2026-10-31
---

The model chooses its next action from six tools: `record_analysis`, `search_qloo`,
`link_reference`, `drop_reference`, `test_reach` and `finish`. It retries spellings, tries other
types and refuses doubtful identities on its own judgment. In live runs it corrected "Radio Head"
to Radiohead and searched both films and books for Dune.

## What the server enforces

The model cannot talk its way past these, and each has a test:

- A safety hold ends the run before any Qloo call.
- A reference must literally appear in the post, so it cannot add culture of its own.
- A link must use an entity returned by a search in this run.
- `finish` is refused while any reference is unresolved.
- A position snaps to the nearest stop on the scale, and off-topic posts stay unscored.
- Ambiguous posts are capped below the confidence bar.
- Turn and call budgets are hard limits.
- Reach is always tested for a linked post, even if the model skips that step.

## Reach

A real platform has far more readers than the four samples, so a post is also tested against every
interest in the catalog, up to the call budget. A simulated reader sits 50 points from the post on
its topic and holds one catalog interest. It uses the same bridge rules and real Qloo rankings, is
labelled as simulated, and can be opened to see the post arrive.

## Model chain

The first turn decides safety and viewpoint, so it goes to Gemini 4 Argon. Later turns use the
routine chain to keep a run near ten seconds. Offline seed building uses Argon throughout.

- Critical: `gemini-4-argon`, `gemini-3.5-flash-lite`, `gemini-3-flash-preview`,
  `gemini-3.8-flash`, `gemini-2.5-flash`
- Routine: the same list without Argon

A failed call moves straight to the next model. If every model fails, the agent backs off and
walks the whole chain again, up to four passes inside a 60-second deadline per call. Models that
failed in a run are tried last. Switching models mid-run was tested live in every direction.

Seed building finished 48 of 48 posts through repeated Argon timeouts. Positions matched the intended
side, and the one disagreement was the agent's correction: a director using AI only for previs belongs
at stop 30, "fine for rough ideas, never in the finished work", which a binary label had wrong.
