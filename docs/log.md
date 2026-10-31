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
