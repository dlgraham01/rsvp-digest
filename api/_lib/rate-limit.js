/**
 * Best-effort in-memory sliding-window rate limiter.
 * State lives in one serverless instance, so the effective limit is per warm instance,
 * not global. It stops casual abuse and loops; for a hard guarantee use Vercel's
 * WAF rate limiting or a shared store (e.g. Upstash).
 */
export function createLimiter({ limit, windowMs, maxKeys = 5000, now = Date.now } = {}) {
  const hits = new Map()
  return function check(key) {
    const t = now()
    const recent = (hits.get(key) || []).filter(ts => t - ts < windowMs)
    if (recent.length >= limit) {
      hits.set(key, recent)
      return { ok: false, retryAfter: Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000)) }
    }
    recent.push(t)
    hits.delete(key) // re-insert so Map order tracks recency
    hits.set(key, recent)
    if (hits.size > maxKeys) hits.delete(hits.keys().next().value)
    return { ok: true, retryAfter: 0 }
  }
}

/** Client IP as seen by Vercel's edge (x-vercel-forwarded-for is set by Vercel, not spoofable). */
export function clientIp(req) {
  const h = req.headers || {}
  const raw = h['x-vercel-forwarded-for'] || h['x-real-ip'] || h['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  return String(raw).split(',')[0].trim()
}

/** Returns true if the request was rejected (response already sent). */
export function rejectIfLimited(limiter, req, res) {
  const r = limiter(clientIp(req))
  if (r.ok) return false
  res.setHeader('retry-after', String(r.retryAfter))
  res.status(429).json({ error: 'Too many requests, try again shortly' })
  return true
}
