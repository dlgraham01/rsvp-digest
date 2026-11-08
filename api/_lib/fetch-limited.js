import { assertPublicUrl } from './ssrf.js'

const UA = 'Mozilla/5.0 (compatible; rsvp-digest/0.1; personal reader)'

/**
 * Fetch with SSRF checks on every redirect hop, a timeout and a body size cap.
 * Returns { url, contentType, buffer }.
 */
export async function fetchLimited(rawUrl, { maxBytes = 15 * 1024 * 1024, timeoutMs = 8000, maxRedirects = 5, lookup, fetchImpl = fetch } = {}) {
  let current = rawUrl
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const url = await assertPublicUrl(current, lookup)
    const res = await fetchImpl(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5' }
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), url).toString()
      continue
    }
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`)
    const declared = Number(res.headers.get('content-length') || 0)
    if (declared > maxBytes) throw new Error('Response too large')
    const chunks = []
    let total = 0
    for await (const chunk of res.body) {
      total += chunk.length
      if (total > maxBytes) throw new Error('Response too large')
      chunks.push(chunk)
    }
    return {
      url: url.toString(),
      contentType: (res.headers.get('content-type') || '').toLowerCase(),
      buffer: Buffer.concat(chunks)
    }
  }
  throw new Error('Too many redirects')
}
