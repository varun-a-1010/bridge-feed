# Change log

## 2026-10-31, second pass

- Replaced preferences with six contested topics, and yes or no stances with 11-stop scales where
  every stop is a specific statement. Gemini now places each post on the same scale.
- Replaced "Change views" with rating again after reading. Movement is counted in either direction.
- Made author scores public and kept each reader's own scores in their browser.
- Added sports as interests, using Qloo brands, and a control check for entities that rank highly
  for nearly everyone. Rebuilt all sample posts through the agent.
- Repositioned the product as a prototype of a social platform built against the bubble. Renamed
  the Typical feed to Your bubble, and moved sample readers into a single-row carousel.
- Added four sample readers and gave all eight interests that connect, so seven get four or five
  bridges and one gets three. Removed ten weak links by hand after reading all of them.
- Rewrote the example posts around works with proven links, after seven of twelve reached nobody.
- Added a second Vertex project. A failed call now tries the same model there before the chain
  moves to the next model, so a quota limit on one project keeps Argon in use.
- Added the sense check after Radiohead to Buenos Aires showed that rank alone is not a connection.
  Gemini can only remove a link Qloo proposed, every bridge carries a plain reason, and unchecked
  links stay out. Widened Qloo's candidates, added 36 posts across more cultural worlds, and removed
  places entirely.
- Replaced score numbers on posts with a position between two named ends, made the logo go home, and
  rebuilt posting around who a view could reach, with the agent's steps one click away.
- Redrew both cables with a clip reveal, because the dash technique cut them short once the line was
  stretched.
- Paced all Qloo requests after every custom reader lost one or two lookups to rate limits, and
  moved the notice to Bridge feed, the only place it matters.
- A post now reaches simulated readers built from the catalog, because almost no post connected to
  the four samples. Reach no longer depends on the model choosing to test it.
- Fixed silent reach failures. Film and brand lists held 50 entities, so any new one exceeded Qloo's
  limit of 50 candidates and every query failed. Lists now stop at 42, and one failed query no longer
  loses the whole test. Evidence now reads only the reader's own interests.
- Labelled every post's score with its topic and the statement it stands for. Examples now speak for
  the reader's own side. Readers can delete their posts, and starting over clears them.
- Removed the type picker from search. Results and picks now show image, type and year, and custom
  profiles keep their images. The landing hero appears only on the first step.
- Redesigned around the bridge itself: a landing hero showing a real bridge from the data, full-width
  crossing bands in the feed, Qloo images as post attachments, avatars and a score line.

## 2026-10-31

- Built Bridge Feed: single-interest Qloo ranking, deterministic bridge eligibility, a Gemini
  intake agent with server-enforced guardrails, 48 sample posts built through the real agent,
  recorded rankings, onboarding, both feeds, the provenance panel and Create Post.
- Replaced small in-feed ranking with reference pools of about 30 entities per type, after
  "#1 of 4" results proved meaningless. Qualifying posts fell from about two thirds to one third.
- Added the model chain led by Gemini 4 Argon, with backoff so that rate limits delay a run
  instead of ending it. Removed Gemini 3.8 Flash as a lead model after intermittent timeouts.
