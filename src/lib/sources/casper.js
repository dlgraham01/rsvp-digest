/**
 * Source adapter for thestephencasper/whatiscasreading.
 * Data lives in data/index.json (list of dates) and data/<date>.json (entries).
 *
 * Source interface (shared by all sources):
 *   id, name
 *   listDays(): Promise<string[]>                      newest first
 *   getDay(day): Promise<Item[]>
 *   Item: { id, tag, title, summary, date, links: {title, url}[] }
 */

const BASE = 'https://raw.githubusercontent.com/thestephencasper/whatiscasreading/main/data'

async function fetchJson(url, fetchImpl) {
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

/** Normalize one raw entry; tolerant of missing fields. */
export function normalizeEntry(raw, day, index) {
  const links = (Array.isArray(raw.links) ? raw.links : [])
    .filter(l => l && typeof l.url === 'string' && /^https?:\/\//i.test(l.url))
    .map(l => ({ title: l.title || l.url, url: l.url }))
  return {
    id: `${day}#${index}`,
    tag: raw.tag || '',
    title: raw.title || '(untitled)',
    summary: raw.summary || '',
    date: raw.date || day,
    links
  }
}

export function createCasperSource(fetchImpl = (...a) => fetch(...a)) {
  return {
    id: 'casper',
    name: 'Casper daily digest',

    async listDays() {
      const data = await fetchJson(`${BASE}/index.json`, fetchImpl)
      return Array.isArray(data.digests) ? data.digests : []
    },

    async getDay(day) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Invalid day: ${day}`)
      const data = await fetchJson(`${BASE}/${day}.json`, fetchImpl)
      return (data.entries || []).map((e, i) => normalizeEntry(e, day, i))
    }
  }
}

/** Plain text of an item suitable for RSVP (summary-only "quick mode"). */
export function itemToText(item) {
  return `${item.title}. ${item.summary}`.replace(/\s+/g, ' ').trim()
}

/** Plain text for a whole day's entries. */
export function dayToText(items) {
  return items.map(itemToText).join('\n\n')
}
