import { describe, it, expect, vi } from 'vitest'
import { createCasperSource, normalizeEntry, itemToText, dayToText } from '../lib/sources/casper.js'

const ok = body => Promise.resolve({ ok: true, json: () => Promise.resolve(body) })

describe('normalizeEntry', () => {
  it('keeps only http(s) links and fills defaults', () => {
    const e = normalizeEntry({ links: [{ url: 'javascript:alert(1)' }, { url: 'https://a.com/x' }] }, '2026-01-01', 3)
    expect(e.id).toBe('2026-01-01#3')
    expect(e.title).toBe('(untitled)')
    expect(e.links).toEqual([{ title: 'https://a.com/x', url: 'https://a.com/x' }])
  })
})

describe('createCasperSource', () => {
  it('lists days', async () => {
    const f = vi.fn(() => ok({ digests: ['2026-11-07', '2026-11-06'] }))
    expect(await createCasperSource(f).listDays()).toEqual(['2026-11-07', '2026-11-06'])
  })

  it('loads and normalizes a day', async () => {
    const f = vi.fn(() => ok({ entries: [{ tag: 'News', title: 'T', summary: 'S', links: [] }] }))
    const items = await createCasperSource(f).getDay('2026-11-07')
    expect(items[0]).toMatchObject({ tag: 'News', title: 'T', date: '2026-11-07' })
  })

  it('rejects malformed day and HTTP errors', async () => {
    const src = createCasperSource(() => Promise.resolve({ ok: false, status: 404 }))
    await expect(src.getDay('../etc')).rejects.toThrow('Invalid day')
    await expect(src.getDay('2026-11-07')).rejects.toThrow('404')
  })
})

describe('text helpers', () => {
  it('builds text', () => {
    const a = { title: 'A', summary: 'one  two' }
    expect(itemToText(a)).toBe('A. one two')
    expect(dayToText([a, a])).toBe('A. one two\n\nA. one two')
  })
})
