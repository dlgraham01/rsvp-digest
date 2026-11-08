import { fetchLimited } from './_lib/fetch-limited.js'
import { extractArticle } from './_lib/extract-html.js'
import { parseArxivId, arxivHtmlUrl, extractArxivHtml } from './_lib/arxiv.js'

/**
 * GET /api/extract?url=<http(s) url>
 * -> { url, title, kind, sections: [{ heading, text, skip, reason }] }
 * kind: 'arxiv-html' | 'article' | 'pdf' (pdf: client fetches and parses; no sections)
 */
export async function extract(rawUrl, deps = {}) {
  const fetcher = deps.fetchLimited || fetchLimited
  const id = parseArxivId(rawUrl)
  if (id) {
    try {
      const r = await fetcher(arxivHtmlUrl(id))
      const out = extractArxivHtml(r.buffer.toString('utf8'))
      if (out) return { url: rawUrl, kind: 'arxiv-html', ...out }
    } catch { /* fall through to PDF */ }
    return { url: rawUrl, kind: 'pdf', title: '', sections: [], pdfUrl: `https://arxiv.org/pdf/${id}` }
  }

  const r = await fetcher(rawUrl)
  if (r.contentType.includes('application/pdf')) {
    return { url: r.url, kind: 'pdf', title: '', sections: [], pdfUrl: r.url }
  }
  const out = extractArticle(r.buffer.toString('utf8'))
  if (!out) throw new Error('Could not extract readable content')
  return { url: r.url, kind: 'article', ...out }
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost').searchParams.get('url')
  if (!url) return res.status(400).json({ error: 'Missing url parameter' })
  try {
    const result = await extract(url)
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate')
    res.status(200).json(result)
  } catch (e) {
    res.status(422).json({ error: e.message })
  }
}
