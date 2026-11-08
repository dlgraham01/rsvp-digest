# RSVP Digest

A PWA for speed-reading (RSVP) the daily digest at
[thestephencasper/whatiscasreading](https://github.com/thestephencasper/whatiscasreading),
either as one-line summaries or as full linked articles.

The RSVP display, controls and file parsers are derived from an MIT-licensed
Svelte RSVP reader (see LICENSE).

## How it works

- `src/lib/sources/` - source adapters. A source implements `listDays()` and `getDay(day)`
  and returns items `{ id, tag, title, summary, date, links[] }`. Register new ones in `sources/index.js`.
- `api/extract.js` - Vercel function. Fetches a URL (SSRF-checked, size-capped) and returns
  `{ title, kind, sections[] }`. arXiv papers use arXiv's HTML version and flag references,
  acknowledgements and appendices as skipped; other pages go through Mozilla Readability.
- `api/pdf.js` - streams a PDF (max ~4 MB, Vercel's response limit) so the browser can parse it.
  Used when an arXiv paper has no HTML version; back matter is then guessed by heuristic.
- The preview step lets you toggle sections before reading.

## Develop

```bash
npm install --legacy-peer-deps
npm test
npx vercel dev   # serves the app and /api together (plain `npm run dev` has no /api)
```

`--legacy-peer-deps` was needed because plain `npm install` crashed in npm 11.4 on this machine.

## Deploy

Import the repo in Vercel; no configuration needed.

## Not done yet

- Offline caching / service worker, per-article saved progress
- Rate limiting on `/api/*` (the endpoints are open to anyone with the URL)
