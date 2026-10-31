---
type: Reference
title: Verification
description: What has been checked, and what has not.
timestamp: 2026-10-31
last_verified: 2026-10-31
---

`npm run check` covers formatting, tests, types and the production build. The tests use mock
providers. Live checks used the real Qloo and Vertex APIs.

## Checked live

- Rank-against-candidates across movies, TV, games, brands, artists and books.
- 10 signals against 29 candidates, and per-input explanations.
- Model reachability and tool-calling on the app's Vertex project.
- The agent on real posts, including a prompt-injection attempt and misspelled references.
- 109 sample posts built through the live agent, with positions checked against the intended side.
- Sports teams and leagues resolve as Qloo brands.

## Not checked

- No browser or visual QA was performed, following the owner's standing instruction.
- Nothing here measures real people. The evaluation replays recorded rankings for simulated
  readers, and rating again reports one reader's own answers. No claim is made about persuasion or
  polarization.
