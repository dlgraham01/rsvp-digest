import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/file-parsers.js', () => ({ parseFile: vi.fn(async () => 'body '.repeat(100) + 'References [1] Someone') }))

import { fetchExtraction, splitPdfBackMatter, countWords, sectionsToText } from '../lib/extract-client.js'

const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body })

describe('splitPdfBackMatter', () => {
  it('cuts at a References heading in the second half', () => {
    const text = 'word '.repeat(100) + 'References [1] A. Author'
    const [main, back] = splitPdfBackMatter(text)
    expect(main.skip).toBe(false)
    expect(main.text).not.toContain('References')
    expect(back.skip).toBe(true)
    expect(back.text.startsWith('References')).toBe(true)
  })
  it('ignores the word early in the document', () => {
    const text = 'References are useful. ' + 'word '.repeat(100)
    expect(splitPdfBackMatter(text)).toHaveLength(1)
  })
})

describe('helpers', () => {
  it('counts words and joins kept sections', () => {
    expect(countWords('  a b  c ')).toBe(3)
    expect(countWords('')).toBe(0)
    expect(sectionsToText([{ text: 'A', skip: false }, { text: 'B', skip: true }, { text: 'C', skip: false }])).toBe('A\n\nC')
  })
})

describe('fetchExtraction', () => {
  it('returns article data', async () => {
    const f = vi.fn(async () => json({ kind: 'article', title: 'T', sections: [{ text: 'x' }] }))
    expect((await fetchExtraction('https://a.com/x?y=1', f)).kind).toBe('article')
    expect(f.mock.calls[0][0]).toBe('/api/extract?url=' + encodeURIComponent('https://a.com/x?y=1'))
  })
  it('surfaces server errors', async () => {
    const f = vi.fn(async () => json({ error: 'nope' }, false, 422))
    await expect(fetchExtraction('https://a.com', f)).rejects.toThrow('nope')
  })
  it('downloads and splits pdfs', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json({ kind: 'pdf', pdfUrl: 'https://x.test/a.pdf', sections: [] }))
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['%PDF-']) })
    const out = await fetchExtraction('https://x.test/a.pdf', f)
    expect(out.sections.length).toBe(2)
    expect(out.sections[1].skip).toBe(true)
  })
})
