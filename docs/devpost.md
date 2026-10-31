---
type: Reference
title: Devpost copy
description: Submission text for the Qloo Agentic Hackathon.
timestamp: 2026-10-31
---

**Tagline:** Your feed thinks you're right about everything. Bridge Feed has some concerns.

## Inspiration

Your social media feed is the most attentive yes-man ever built. It has studied you for years, at tremendous expense, and arrived at a bold finding: you are right about everything, and anyone who disagrees is either an idiot or a bot. It then shows you more of this, forever, because a good fight keeps you scrolling and scrolling pays for the data center.

The result is a bubble, and the bubble is polarizing by design. The people on the other side of an argument appear in your feed only as a screenshot someone is dunking on. You have not heard them finish a sentence since 2016.

But here is the loophole. Two people can be at each other's throats about free speech and still own the same Radiohead album. Every feed on earth knows this and does nothing with it, because a shared love of Radiohead doesn't hold attention like a good fight does.

So we built a feed that runs the other way. It takes the thing you love and uses it to smuggle in the view you would otherwise never see.

## What it does

Bridge Feed is a prototype of a social platform built against the bubble. It pulls apart two things every platform mashes together: what you believe, which you score yourself, and what you love, which Qloo understands.

You start by scoring six contested topics from 0 to 100. We considered simply asking "do you support free speech?", but everyone in history has answered yes, including several people who were burning books at the time. So every 10 points is a specific statement you have to actually stand behind.

Add a few interests and you meet Your bubble: the feed most platforms would give you, a warm bath of people who agree with you. Flip to Bridge feed and a few posts from the far side of the scale wade in, each one carrying its receipt: "Qloo compared 42 films for Björk alone, and Her ranked #1." Posts are never rewritten, softened or summarized. You get the real person, in their own words, at full strength.

If your interests fall outside our sample posts, you do not get an empty feed. Qloo finds the works that sit closest to what you love, the sense check keeps only the ones that make sense, and Gemini writes clearly labelled simulated posts around them, in the voice of the sample set. They pass through exactly the same checkpoints as every other post.

Then you rate yourself again. If your scores moved, we count it, in either direction. If they didn't, that's a real answer too.

Post your own view and an agent reads it, places it on the scale, finds what it mentions on Qloo, and shows you who it could reach on the other side, and why. Then you can open that person's feed and watch your post land in it, like a Trojan horse full of opinions.

## Why Qloo is essential

An LLM can tell you that two posts disagree. So can anyone who has attended Thanksgiving. What it cannot do is discover which of millions of cultural connections are worth following, and if you ask, it will cheerfully invent one.

In Bridge Feed, only Qloo can propose a bridge, by ranking something a post mentions for one thing you love. A shared word can't do it: a literal match never creates a bridge. Gemini then reviews each link and can only remove it, so Qloo stays the source, and every bridge you see carries a plain reason, like "Both explore intimacy, technology, and longing with a tender, futuristic sensibility."

## How we built it

A post has to clear more checkpoints than a carry-on bag before it reaches you:

1. **It has to disagree.** Gemini places every post on an 11-stop scale, and it must sit at least 40 points from your score.
2. **Qloo has to connect it.** Something the post names must rank in the top 20% for one of your interests alone. We rank one interest at a time, because blended signals wash taste out to beige.
3. **It has to be news.** Anything you already picked doesn't count. Telling a Knicks fan about the Knicks isn't a bridge.
4. **It can't be merely popular.** A control check tests each entity across all 45 catalog interests. Anything that ranks near the top for more than a quarter of them is everybody's favorite, not your connection.
5. **It has to make sense to a human.** Gemini plays a skeptical friend, reviews the pair, and may only reject. An approval needs a one-line reason under 14 words. If a link can't be checked, it stays out.

Survivors get fixed slots in your feed, at most five, with at most two per topic, so you are visited rather than ambushed.

**The agent:** a Gemini tool loop picks its own next step across six tools: record the analysis, search Qloo, link a reference, drop a reference, test reach, and finish. It retries spellings, decides from the sentence whether "Dune" is the film or the book, and drops what it isn't sure about. The post is treated as untrusted input, so "ignore your instructions" gets nowhere, and the server enforces budgets on turns, searches and reach checks that the model can't argue with.

**Generated posts:** when a custom reader's interests are missing from the sample, Qloo's insights return each interest's nearest works by type, the sense check filters them, and Gemini writes posts that either argue the far side or sit on the reader's side. Each carries the real Qloo rank that put it there. A slow or failed fill never touches the feed you already have.

**Reach:** each new post is tested against eight sample readers, plus simulated readers built from the catalog, using exactly the same five checkpoints. Simulated readers are labelled, and if nobody connects, the app says so.

**Qloo plumbing:** `/search` resolves entities, and `/v2/insights` with `filter.results.entities` ranks candidates for one interest at a time, up to Qloo's limit of 50 per query. Calls share a pace and retry, since bursts get rate-limited. 270 recorded rankings keep sample readers instant, and custom interests go live, with links reviewed on the fly under a daily budget.

**Reliability:** Gemini 4 Argon handles the critical judgment. A failed call tries the same model on a second Vertex project, because quota is per project, then walks a chain of Flash models and backs off. Tool state survives switching mid-run.

**Stack:** TypeScript, Fastify and React, with 75 automated tests. Your scores never go to Qloo.

## Challenges

Our first version was statistically flawless and completely insane. It told a Radiohead fan that Buenos Aires was a bridge, because Qloo ranked that city first among a list of mostly American ones. Buenos Aires is lovely. It is not a Radiohead album.

Shared taste tags were no better: they linked Radiohead to design software, on the grounds that similar people use both. So we split discovery from judgment. Qloo proposes, and Gemini acts as the friend who says "that makes no sense." Across 520 candidate links, about four in five were thrown out, and we read every survivor ourselves and cut ten more. What's left reads like something a person would say.

## Accomplishments

109 sample posts went through the real agent, and every position landed on the side we wrote it for. An earlier run even corrected us: a director using AI only for rough storyboards belongs near the skeptical end, which our yes-or-no label had wrong. Being fact-checked by your own software is humbling, and we recommend it.

All eight sample readers get real bridges, across sports, comedy, food, games, pop and film.

## What we learned

Anyone claiming to have cured polarization is selling something. The research on exposure to opposing views is mixed, and it can backfire. So Bridge Feed doesn't promise to change your mind. Rating again gives a platform a way to find out, counted in either direction. This demo sees one reader at a time, so it proves nothing about people yet. The instrument is the point.

## What's next

The full platform: real profiles, follows, and conversations between people who disagree, with bridges as the way they meet. Plus a study with real readers comparing score movement between the two feeds, and a dial for how much disagreement you can take before lunch.

## Limits

Sample posts are fictional. Rankings show cultural association, not what anyone believes, and the app never infers your views from your taste.
