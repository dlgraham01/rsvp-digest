import { fetchLimited } from './_lib/fetch-limited.js'

/**
 * GET /api/pdf?url=<http(s) url>
 * Streams a PDF through the server so the browser can parse it despite CORS.
 * Only responses that are actually PDFs are returned.
 */
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost').searchParams.get('url')
  if (!url) return res.status(400).json({ error: 'Missing url parameter' })
  try {
    const r = await fetchLimited(url, { maxBytes: 4 * 1024 * 1024, timeoutMs: 9000 })
    if (!r.contentType.includes('application/pdf') && r.buffer.subarray(0, 5).toString() !== '%PDF-') {
      return res.status(415).json({ error: 'Not a PDF' })
    }
    res.setHeader('content-type', 'application/pdf')
    res.setHeader('cache-control', 's-maxage=86400, stale-while-revalidate')
    res.status(200).send(r.buffer)
  } catch (e) {
    res.status(422).json({ error: e.message })
  }
}
