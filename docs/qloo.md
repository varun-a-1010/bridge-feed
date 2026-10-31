---
type: Reference
title: Qloo use
description: The queries Bridge Feed sends and how their results become a bridge.
timestamp: 2026-10-31
last_verified: 2026-10-31
---

The adapter calls only `https://hackathon.api.qloo.com`, with the key in a header, a 12-second
timeout and bounded retries on rate limits and server errors.

- `/search` resolves a named reference to an entity. A reader's search covers every supported type
  in one call, so results that share a name are told apart by type and year.
- `/v2/insights` with `filter.type`, one ID in `signal.interests.entities` and the candidates in
  `filter.results.entities` ranks those candidates for that one interest.

Ranking one interest at a time matters. Blended signals washed taste out in live tests, while
single signals separated it: Radiohead put Gattaca, Her and Blade Runner first, and Taylor Swift
put La La Land and The Devil Wears Prada first.

## From rank to bridge

Affinity is normalized per query, so it is used only to order one response. A post qualifies
when an entity it names, which the reader did not select, reaches the top 3 or top 10% among at
least 12 entities of its type. The reference pool exists because a small pool makes first place
meaningless: with four games in the feed, something has to be #1.

An entity Qloo omits from a response counts as no evidence. It is never filled in.

## Control check

A re-ranking always returns an order, so a high rank alone can just mean something is popular. The
recorded rankings show how many tested interests place each entity inside the cutoff. An entity that
one in four or more of them rank that highly is treated as popular, not as a connection, and the app
shows that share in the explanation. Entities from new posts have no recorded history, so this check
does not apply to them.

## What leaves the server

Only entity IDs. Scores, post text, names and identifiers never go to Qloo, and a test asserts
the exact parameter list.

## Known limits

The pools come from Qloo results for the interest catalog, so they lean toward what that catalog
contains. Sports teams and leagues are Qloo brands, not a separate type. Ranks are relative to these pools. A bridge states a cultural
association between two things, not anything about what fans of either one believe.
