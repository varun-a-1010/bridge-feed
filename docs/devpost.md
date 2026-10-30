---
type: Reference
title: Devpost copy
description: Submission text for the Qloo Agentic Hackathon.
timestamp: 2026-10-31
---

**Tagline:** A feed that uses what you share to reach what you disagree with.

## Inspiration

Most feeds use similarity to find more similarity. Agreement and taste get treated as one signal,
so a good post from someone you disagree with never reaches you. But two people can disagree about
remote work and love the same film. We wanted to see if shared taste could be the path to a view
you would otherwise scroll past.

## What it does

Bridge Feed keeps two things apart: what you believe, which you state outright, and what you love,
which Qloo understands. Pick your views and a few interests, and you get a normal feed. Switch to
Bridge feed and a few posts from the other side cross over. Each one shows why it reached you:
"Qloo compared 40 films for Radiohead alone, and Her ranked #1."

Posts are never rewritten. Write your own and an agent reads it, finds its references on Qloo, and
tests which opposing readers it could reach. You can then open one of their feeds and see it arrive.

## Why Qloo is essential

An LLM can tell that two posts disagree. It cannot supply a measured link between a privacy-minded
Radiohead fan and a post about the film Her. In Bridge Feed, only a Qloo ranking can qualify a post.
A shared word cannot: a literal match alone never creates a bridge. Every bridge shown across 200
simulated readers came from a Qloo ranking, and none relied on a shared title.

## How we built it

- **Agent:** a Gemini tool loop chooses each step: search, retry a spelling, reject a doubtful
  match, test reach, finish. The server enforces the rules the model cannot break.
- **Qloo:** `/search` resolves entities, and `/v2/insights` ranks candidates for one interest at a
  time. Blended signals washed taste out in testing, while single signals separated it clearly.
- **Reliability:** Gemini 4 Argon handles the critical judgment, with a chain of Flash models behind
  it, so a rate limit on any model delays a post instead of breaking it.
- **Stack:** TypeScript, Fastify and React, with 43 tests.

## Challenges

Raw affinity is normalized per query, so it cannot be a threshold. Early results also looked great
and meant little: with four games in the feed, one must rank first. We fixed that by ranking each
entity against about 30 of its type and accepting only the top few, which cut qualifying posts to
about a third.

## Accomplishments

48 sample posts went through the real agent, with 64 confirmed Qloo entities and no viewpoint
mismatches. The agent left 7 references unresolved instead of guessing. One post has no entities
and so can never bridge, which is the behaviour we wanted.

## What we learned

The honest claim is smaller and stronger than "fixing polarization", which the research does not
support. Bridge Feed shows that cultural similarity can create an intelligible path to a different
perspective. Whether that changes anything for real people would need a real study.

## What's next

A study with real readers, control over how many differing posts you see, and feedback that tunes
the bridge cutoff.

## Limits

Sample posts are fictional. Rankings show cultural association, not what anyone believes. Qloo
never receives your views, and the app never infers them from your taste.
