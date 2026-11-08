import { describe, it, expect } from 'vitest'
import { createLimiter, clientIp, rejectIfLimited } from './rate-limit.js'

describe('createLimiter', () => {
  it('allows up to the limit then blocks, per key', () => {
    let t = 0
    const check = createLimiter({ limit: 2, windowMs: 1000, now: () => t })
    expect(check('a').ok).toBe(true)
    expect(check('a').ok).toBe(true)
    const blocked = check('a')
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBe(1)
    expect(check('b').ok).toBe(true)
  })

  it('frees capacity after the window passes', () => {
    let t = 0
    const check = createLimiter({ limit: 1, windowMs: 1000, now: () => t })
    expect(check('a').ok).toBe(true)
    expect(check('a').ok).toBe(false)
    t = 1001
    expect(check('a').ok).toBe(true)
  })

  it('bounds memory by evicting the oldest key', () => {
    const check = createLimiter({ limit: 1, windowMs: 1000, maxKeys: 2, now: () => 0 })
    check('a'); check('b'); check('c')
    expect(check('a').ok).toBe(true) // 'a' was evicted
  })
})

describe('clientIp / rejectIfLimited', () => {
  it('prefers the Vercel header and takes the first hop', () => {
    expect(clientIp({ headers: { 'x-vercel-forwarded-for': '1.2.3.4, 5.6.7.8', 'x-forwarded-for': '9.9.9.9' } })).toBe('1.2.3.4')
  })

  it('sends 429 with Retry-After when limited', () => {
    const sent = {}
    const res = {
      setHeader: (k, v) => { sent[k] = v },
      status: (c) => { sent.code = c; return { json: (b) => { sent.body = b } } },
    }
    const check = createLimiter({ limit: 1, windowMs: 5000, now: () => 0 })
    const req = { headers: { 'x-real-ip': '1.1.1.1' } }
    expect(rejectIfLimited(check, req, res)).toBe(false)
    expect(rejectIfLimited(check, req, res)).toBe(true)
    expect(sent.code).toBe(429)
    expect(sent['retry-after']).toBe('5')
  })
})
