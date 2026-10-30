---
type: Reference
title: Architecture
description: How a profile becomes two feeds and how a new post enters them.
timestamp: 2026-10-31
last_verified: 2026-10-31
---

A Fastify server holds the Qloo and Vertex credentials and serves a React client. There is no
database. Sample data is in `data/`, and the browser keeps the reader's scores, starting baseline
and their own posts in local storage, so one person's writing never reaches another visitor.

`POST /api/feed` receives a profile and any local posts. `server/feed.ts` asks Qloo to rank every
entity of each relevant type for each interest alone, then `shared/feed.ts` composes both feeds
deterministically. The typical feed holds posts within 40 points of the reader's scores, closest
first. The bridge feed is the same list with up to five qualified posts added, at most one in four
slots and two per topic.

## Scales and rating again

Each topic is an 11-stop scale in `shared/model.ts`, and every stop is a specific statement. Stops
are radio inputs, so "not rated" stays distinct from a chosen 50. The baseline is saved at
onboarding. Rating again updates the scores and re-ranks the feed, and **Your scores** shows the
movement in either direction. Author scores are public and read from their posts. A reader's own
scores stay in their browser.

`POST /api/analyze` runs the intake agent and streams each step as a line of JSON.

## Limits

Each client gets 6 agent runs and 40 feed requests a minute. The server allows 4 concurrent runs
and 400 a day. A reader has at most 6 interests and 8 local posts. A run has at most 10 turns, 8
searches, 2 reach checks and 30 ranking calls.

## Data

`data/posts.json` is built by the real agent from `scripts/seed-data.ts`. `data/pool.json` holds
about 30 Qloo entities per type for comparison. `data/ranks.json` records every catalog interest
against every type, so the demo keeps working if Qloo is unavailable. Rebuild them with
`npm run data:interests`, `data:posts`, `data:pool` and `data:ranks`, in that order.
