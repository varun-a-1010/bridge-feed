# Bridge Feed

Other platforms keep you in your bubble. Bridge Feed uses what you love to get you out. Built for
the Qloo Agentic Hackathon.

**Live demo:** https://bridge-feed.slate-app.online

Choose a sample reader, then switch from **Your bubble** to **Bridge feed**. The same posts are
ranked the usual way, plus a few from people far from you on the scale, each with the Qloo link that
brought it there. Open **Why this reached you** to see what came from the post, what came from Qloo
and what is this app's own interpretation. Then **Rate again** and see if anything moved, or
**Write** a post and watch the agent work.

## The idea

Most social platforms learn what you like and keep showing you people who agree with you. Over time,
your interests become your bubble. Bridge Feed is a prototype of a platform built the other way
around: it deliberately brings you views you disagree with, and uses the culture you already share
as the way in.

This demo is the feed at the heart of that platform. Profiles, follows and conversations would come
next, and none of them exist yet.

It works because agreement and cultural affinity are different things. Two people can disagree about
free speech and love the same film. Bridge Feed keeps the two apart:

- **Positions** sit on six 0 to 100 scales: AI in creative work, animal welfare, free speech, privacy,
  success and personal freedom. Everyone claims to support free speech, so every 10 points is a
  specific statement you have to endorse. "80" means "hate speech should be illegal, not just banned
  by platforms." Gemini places each post on the same scale from its text.
- **Cultural connections** come only from Qloo, which receives opaque entity IDs and nothing else.

A post at least 40 points from your score qualifies only when Qloo ranks something it names near the
top for one of your interests alone, you did not select that thing yourself, and it is not something
that ranks highly for nearly everyone. A shared word can never do it. The post is shown exactly as
written.

## Measuring change

A platform built to open people up should be able to check whether it does. So Bridge Feed asks
again after you read. Your scores show how far you moved, in either direction, and staying put
counts as an answer. A yes or no question would miss a move from 80
to 70, but a scale catches it, and each step means endorsing a different statement.

This demo sees only you, so it measures nothing about people in general. It makes no claim about
polarization. It shows how the full platform could test whether leaving the bubble changes minds, and the evidence
on exposure to opposing views is mixed, so the honest result might be that it does not. See the
[evaluation](docs/evidence/evaluation.md).

## How it works

```
Post text ──> Gemini agent ──> topic, position, named references
                   │
                   └── search, retry, link or drop ──> Qloo /search
                   └── test reach ───────────────────> Qloo /v2/insights

Profile ──> one ranking per interest and type ──> Qloo /v2/insights
                   │
                   └──> deterministic rules ──> Your bubble, Bridge feed
```

The agent chooses its own steps, and the server enforces what it cannot break: references must
appear in the post, links must come from a real search, and safety holds stop the run before Qloo is
called. Gemini 4 Argon handles the first, critical turn, and a chain of Flash models covers the rest
and catches failures, so a rate limit delays a post instead of breaking it.

Details: [architecture](docs/architecture.md), [Qloo use](docs/qloo.md), [the agent](docs/agent.md).

## Run it locally

Requires Node 22.12 or newer, a Qloo API key and Vertex AI credentials.

```sh
npm ci
cp .env.example .env   # fill in the values
node --env-file=.env --import tsx server/index.ts &
npx vite --host 127.0.0.1
```

Open http://127.0.0.1:5194. Without credentials the sample feeds still work from recorded Qloo
rankings, but search and Create Post are unavailable.

```sh
npm run check      # formatting, tests, types, production build
npm run evaluate   # replays recorded rankings for 200 simulated readers
```

## Data

Sample posts are by fictional authors and are labelled in the app. They were written by hand, then
processed by the real agent and real Qloo calls. Nothing in `data/` is an invented Qloo result.
Recorded rankings exist so the demo survives a Qloo outage, and the app says when it uses them.

## License

[MIT](LICENSE)
