// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { isPrivateAddress, assertPublicUrl } from './ssrf.js'
import { classifyHeading, cleanText } from './sections.js'
import { parseArxivId, extractArxivHtml } from './arxiv.js'
import { extractArticle } from './extract-html.js'
import { fetchLimited } from './fetch-limited.js'
import { extract } from '../extract.js'

const publicLookup = async () => [{ address: '93.184.216.34' }]

describe('isPrivateAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '192.168.0.5', '172.16.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])('flags %s', ip => {
    expect(isPrivateAddress(ip)).toBe(true)
  })
  it.each(['93.184.216.34', '8.8.8.8', '2606:4700::1111'])('allows %s', ip => {
    expect(isPrivateAddress(ip)).toBe(false)
  })
})

describe('assertPublicUrl', () => {
  it('rejects bad schemes, credentials, private hosts', async () => {
    await expect(assertPublicUrl('file:///etc/passwd', publicLookup)).rejects.toThrow('http(s)')
    await expect(assertPublicUrl('https://u:p@example.com', publicLookup)).rejects.toThrow('Credentials')
    await expect(assertPublicUrl('http://127.0.0.1/', publicLookup)).rejects.toThrow('non-public')
    await expect(assertPublicUrl('http://[::1]/', publicLookup)).rejects.toThrow('non-public')
    await expect(assertPublicUrl('http://internal.test/', async () => [{ address: '10.0.0.2' }])).rejects.toThrow('non-public')
    await expect(assertPublicUrl('nonsense', publicLookup)).rejects.toThrow('Invalid')
  })
  it('accepts public hosts', async () => {
    const u = await assertPublicUrl('https://example.com/a', publicLookup)
    expect(u.hostname).toBe('example.com')
  })
})

describe('fetchLimited', () => {
  const body = text => ({ [Symbol.asyncIterator]: async function* () { yield Buffer.from(text) } })

  it('re-validates redirect targets', async () => {
    const lookup = vi.fn(async host => [{ address: host === 'evil.test' ? '10.0.0.9' : '93.184.216.34' }])
    const fetchImpl = vi.fn(async () => ({ status: 302, ok: false, headers: new Headers({ location: 'http://evil.test/x' }) }))
    await expect(fetchLimited('https://ok.test/', { lookup, fetchImpl })).rejects.toThrow('non-public')
  })

  it('enforces size cap', async () => {
    const fetchImpl = async () => ({ status: 200, ok: true, headers: new Headers(), body: body('x'.repeat(100)) })
    await expect(fetchLimited('https://ok.test/', { lookup: publicLookup, fetchImpl, maxBytes: 10 })).rejects.toThrow('too large')
  })

  it('returns buffer and content type', async () => {
    const fetchImpl = async () => ({ status: 200, ok: true, headers: new Headers({ 'content-type': 'text/html' }), body: body('hi') })
    const r = await fetchLimited('https://ok.test/', { lookup: publicLookup, fetchImpl })
    expect(r.buffer.toString()).toBe('hi')
    expect(r.contentType).toBe('text/html')
  })
})

describe('classifyHeading', () => {
  it.each([
    ['References', 'references'], ['7 Acknowledgements', 'acknowledgements'], ['Appendix A: Details', 'appendix'],
    ['Supplementary Material', 'appendix'], ['Author Contributions', 'back matter']
  ])('skips %s', (h, reason) => expect(classifyHeading(h)).toBe(reason))
  it.each(['Introduction', '3.2 Related Work', 'Experiments', 'Limitations'])('keeps %s', h => {
    expect(classifyHeading(h)).toBeNull()
  })
})

describe('cleanText', () => {
  it('tidies whitespace and punctuation spacing', () => {
    expect(cleanText('a  b  c ,  d .\n\n\n\ne')).toBe('a b c, d.\n\ne')
  })
})

describe('parseArxivId', () => {
  it.each([
    ['https://arxiv.org/abs/2401.01234', '2401.01234'],
    ['https://arxiv.org/pdf/2401.01234v2.pdf', '2401.01234v2'],
    ['https://arxiv.org/html/2401.01234v1', '2401.01234v1'],
    ['https://arxiv.org/abs/cs/0112017', 'cs/0112017']
  ])('%s', (url, id) => expect(parseArxivId(url)).toBe(id))
  it('ignores other hosts', () => {
    expect(parseArxivId('https://example.com/abs/2401.01234')).toBeNull()
    expect(parseArxivId('https://notarxiv.org/abs/1')).toBeNull()
  })
})

const ARXIV_HTML = `<html><body><article class="ltx_document">
<h1 class="ltx_title ltx_title_document">A Paper</h1>
<div class="ltx_abstract"><h6>Abstract</h6><p class="ltx_p">We study things.</p></div>
<section class="ltx_section"><h2 class="ltx_title ltx_title_section">1 Introduction</h2>
<div class="ltx_para"><p class="ltx_p">Intro text <math><mi>x</mi></math> with a cite <cite class="ltx_cite">[1]</cite>here.</p></div></section>
<section class="ltx_section"><h2 class="ltx_title ltx_title_section">2 Acknowledgements</h2><p class="ltx_p">Thanks all.</p></section>
<section class="ltx_bibliography"><h2 class="ltx_title">References</h2><p class="ltx_p">[1] Someone.</p></section>
<section class="ltx_appendix"><h2 class="ltx_title">Appendix A Proofs</h2><p class="ltx_p">Lemma.</p></section>
</article></body></html>`

describe('extractArxivHtml', () => {
  it('splits sections and flags back matter', () => {
    const out = extractArxivHtml(ARXIV_HTML)
    expect(out.title).toBe('A Paper')
    const by = Object.fromEntries(out.sections.map(s => [s.heading, s]))
    expect(by.Abstract.skip).toBe(false)
    expect(by['1 Introduction'].text).toContain('Intro text')
    expect(by['1 Introduction'].text).not.toContain('[1]')
    expect(by['1 Introduction'].skip).toBe(false)
    expect(by['2 Acknowledgements'].reason).toBe('acknowledgements')
    expect(by.References.reason).toBe('references')
    expect(by['Appendix A Proofs'].reason).toBe('appendix')
  })
  it('returns null for non-paper html', () => {
    expect(extractArxivHtml('<html><body><p>nope</p></body></html>')).toBeNull()
  })
})

describe('extractArticle', () => {
  it('extracts main article text and drops chrome', () => {
    const para = 'This is a reasonably long paragraph of article content that Readability should keep because it is substantial. '.repeat(5)
    const html = `<html><head><title>Hello</title></head><body><nav>Menu Home About</nav>
      <article><h1>Hello</h1><p>${para}</p><p>${para}</p></article><footer>Copyright junk</footer></body></html>`
    const out = extractArticle(html)
    expect(out.sections[0].text).toContain('substantial')
    expect(out.sections[0].text).not.toContain('Menu Home')
  })
})

describe('extract', () => {
  it('falls back to PDF for arXiv when HTML is unavailable', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('404'))
    const out = await extract('https://arxiv.org/abs/2401.01234', { fetchLimited: fetcher })
    expect(out.kind).toBe('pdf')
    expect(out.pdfUrl).toBe('https://arxiv.org/pdf/2401.01234')
  })
  it('uses arXiv HTML when available', async () => {
    const fetcher = vi.fn().mockResolvedValue({ buffer: Buffer.from(ARXIV_HTML), contentType: 'text/html', url: 'x' })
    const out = await extract('https://arxiv.org/abs/2401.01234', { fetchLimited: fetcher })
    expect(out.kind).toBe('arxiv-html')
  })
  it('reports pdf content type', async () => {
    const fetcher = vi.fn().mockResolvedValue({ buffer: Buffer.from(''), contentType: 'application/pdf', url: 'https://x.test/a.pdf' })
    expect((await extract('https://x.test/a.pdf', { fetchLimited: fetcher })).kind).toBe('pdf')
  })
})
