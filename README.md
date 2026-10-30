# Bridge Feed

A social feed prototype that uses shared cultural taste to reach a view you would otherwise scroll
past. Built for the Qloo Agentic Hackathon.

**Live demo:** https://bridge-feed.slate-app.online

Choose a sample reader, then switch from **Typical feed** to **Bridge feed**. The same posts are
ranked the usual way, plus a few from the other side, each with the Qloo link that brought it there.
Open **Why this reached you** to see what came from the post, what came from Qloo and what is this
app's own interpretation. Then **Write** a post and watch the agent work.

## The idea

Agreement and cultural affinity are different things. Bridge Feed keeps them apart:

- **Viewpoints** come only from what you select and from the text of a post, read by Gemini.
- **Cultural connections** come only from Qloo, which receives opaque entity IDs and nothing else.

A post from the other side qualifies only when Qloo ranks an entity it names near the top for one of
your interests alone, and you did not select that entity yourself. A shared word can never do it.
The post is shown exactly as written.

This makes no claim about polarization. It shows a path to a different perspective, not that anyone
walks it. See the [evaluation](docs/evidence/evaluation.md).

## How it works

```
Post text ──> Gemini agent ──> topic, viewpoint, named references
                   │
                   └── search, retry, link or drop ──> Qloo /search
                   └── test reach ───────────────────> Qloo /v2/insights

Profile ──> one ranking per interest and type ──> Qloo /v2/insights
                   │
                   └──> deterministic rules ──> Typical feed, Bridge feed
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
