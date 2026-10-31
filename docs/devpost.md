---
type: Reference
title: Devpost copy
description: Submission text for the Qloo Agentic Hackathon.
timestamp: 2026-10-31
---

**Tagline:** Other platforms keep you in your bubble. This one uses what you love to get you out.

## Inspiration

Social platforms learn what you like and show you more of it. Agreement and taste get treated as one
signal, so your interests slowly become a bubble, and a good post from someone you disagree with
never reaches you. But two people can disagree about free speech and love the same film. We wanted
to build the opposite of the usual platform: one that uses what you share to bring you what you
would otherwise never see.

## What it does

Bridge Feed is a prototype of a social platform built against the bubble. This demo is the feed at
its heart. It keeps two things apart: what you believe, which you score yourself, and what you love,
which Qloo understands. Score six contested topics from 0 to 100. Everyone says they support free
speech, so every 10 points is a specific statement you have to endorse. Add a few interests and you
see your bubble: the feed most platforms would give you. Switch to Bridge feed and a few posts from
people far from you cross over, each showing why it reached you: "Qloo compared 42 films for Björk
alone, and Her ranked #1."

Then rate again. Your scores show whether anything moved, in either direction, and staying put is a
real answer. Posts are never rewritten. Post your own view and an agent reads it, finds what it
mentions on Qloo, and shows who it could reach who disagrees with you, and why. You can then open
their feed and see it arrive.

## Why Qloo is essential

An LLM can tell that two posts disagree. It cannot discover which of millions of cultural connections
are worth following. In Bridge Feed, only Qloo can propose a bridge, by ranking what a post mentions
for one thing you love. A shared word cannot: a literal match alone never creates one. Gemini then
reviews each link and can only remove it, so Qloo stays the source and every bridge you see carries a
plain reason, like "Both explore a gritty underworld of crime, gambling, risk, and antiheroes."

## How we built it

- **Agent:** a Gemini tool loop chooses each step: place the post on its scale, search, retry a
  spelling, reject a doubtful match, test reach, finish. The server enforces the rules the model cannot break.
- **Qloo:** `/search` resolves entities, and `/v2/insights` ranks candidates for one interest at a
  time. Blended signals washed taste out in testing, while single signals separated it clearly.
- **Reliability:** Gemini 4 Argon handles the critical judgment, with a chain of Flash models behind
  it, so a rate limit on any model delays a post instead of breaking it.
- **Stack:** TypeScript, Fastify and React, with automated tests for every rule above.

## Challenges

Our first version was statistically sound and humanly absurd. It told a Radiohead fan that Buenos
Aires was a bridge, because Qloo ranked that city first among a list of mostly American ones. Raw
rank proves association, not meaning, and a feed that cannot explain itself loses trust at once.

Shared taste tags were not enough either, because audience labels linked Radiohead to design software.
So we separated discovery from judgment. Qloo proposes, and Gemini acts as a skeptical reader that can
only reject. It turned down about three quarters of what the numbers suggested, and what remained reads
like something a friend would say.

## Accomplishments

84 sample posts went through the real agent, and positions matched the side we wrote them for, with
one exception where the agent was right and we were wrong: a director using AI only for rough
storyboards belongs near the skeptical end, which a yes or no label would have missed.

## What we learned

The honest claim is smaller and stronger than "fixing polarization", which the research does not
support. Rating again gives the platform a way to find out whether leaving the bubble changes minds
at all, and it counts movement in either direction, because exposure to opposing views can backfire. This demo sees
one reader at a time, so it proves nothing about people yet. The instrument is the point.

## What's next

Turning the feed into the full platform: real profiles, follows and conversations between people
who disagree, with bridges as the way they meet. Alongside that, a study with real readers comparing
score movement between the two feeds, and control over how many differing posts you see.

## Limits

Sample posts are fictional. Rankings show cultural association, not what anyone believes. Qloo
never receives your scores, and the app never infers them from your taste.
