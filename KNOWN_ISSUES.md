# Known issues

Observed in real use. Newest first within each section; move items to "Fixed" with the commit when done.

## Open

### 1. Long hyphenated "words" are too long to read
Some hyphenated compounds display as a single oversized RSVP word. Proposed rule: any token longer
than 12 characters that contains a hyphen is split at its hyphens (keeping the hyphen on the left
piece, e.g. `state-of-the-art-model` -> `state-of-`, `the-art-`, `model`).
Expect more word-segmentation problems with usage (long URLs, slashes, em-dashes without spaces,
camelCase, very long single words); collect examples here and handle them in `parseText`
(`src/lib/rsvp-utils.js`) so the article-boundary indices stay consistent.

### 2. Promotional / boilerplate blocks leak into article extracts
Newsletter signups, "recent issues" lists, subscribe boxes etc. are read as article text.
Example: https://aigovernance.com/news/chatgpt-murder-planning-lawsuit-tests-ai-vendor-duty-of-care
ends with:

> Stay ahead of stories like this
> Get every US AI governance development like this one, plus the rest of the week's developments. Every Thursday.
> Recent issues ... (linked issue blurbs with dates like "5 Nov" / "29 Oct")
> Subscribe free
> Free every Thursday. Unsubscribe anytime.

Fix lives in `api/_lib/extract-html.js`. Options: drop elements matching newsletter/subscribe/promo
class or id patterns and `<form>`/`<aside>`/`<nav>`/`<footer>` before Readability; drop trailing
paragraphs that match phrases like "unsubscribe", "subscribe", "sign up"; and/or surface trailing
low-value blocks as skippable sections in the preview step (consistent with arXiv back matter).

### 3. Article counter is too small and out of the reader's focus
The `n/N` badge (top-left of the reading area) is tiny on desktop and outside the line of sight while
reading. Wants a clean way to incorporate it into the RSVP focus itself (e.g. near the focus marker,
a brief flash/transition cue when the article changes, or a subtle pip row under the word).
Component: `src/lib/components/RSVPDisplay.svelte`.

### 4. Digest selector is a popup over the reader
The digest browser opens as a modal overlay with the reader behind it. Wants it to be its own
page/view rather than a popup. Relates to the broader "UI is harsh" feedback (pure black, red
accents, hard borders); direction not decided yet. Component: `src/lib/components/SourceBrowser.svelte`,
overlay wiring in `src/App.svelte`.

## Fixed

_(none yet)_
