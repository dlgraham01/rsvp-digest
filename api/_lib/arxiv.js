import { parseHTML } from 'linkedom'
import { classifyHeading, cleanText } from './sections.js'

/** Extract an arXiv id (new or old style) from abs/pdf/html URLs. */
export function parseArxivId(rawUrl) {
  let u
  try { u = new URL(rawUrl) } catch { return null }
  if (!/(^|\.)arxiv\.org$/i.test(u.hostname)) return null
  const m = u.pathname.match(/^\/(?:abs|pdf|html)\/(.+?)(?:\.pdf)?\/?$/)
  return m ? m[1] : null
}

export function arxivHtmlUrl(id) { return `https://arxiv.org/html/${id}` }

const NOISE = 'math, annotation, .ltx_equation, .ltx_equationgroup, figure, table, .ltx_tag, .ltx_note, .ltx_cite, .ltx_ref_tag, script, style, nav'

function sectionText(node) {
  const clone = node.cloneNode(true)
  clone.querySelectorAll(NOISE).forEach(n => n.remove())
  clone.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(n => n.remove())
  const parts = []
  const seen = new Set()
  for (const p of clone.querySelectorAll('p')) {
    const t = cleanText(p.textContent)
    if (t && !seen.has(t)) { seen.add(t); parts.push(t) }
  }
  return parts.join('\n\n')
}

/**
 * Parse arXiv's LaTeXML HTML into sections, flagging references,
 * acknowledgements and appendices as skipped by default.
 */
export function extractArxivHtml(html) {
  const { document } = parseHTML(html)
  const title = cleanText(document.querySelector('h1.ltx_title_document')?.textContent || document.title || '')
  const sections = []

  const abstract = document.querySelector('.ltx_abstract')
  if (abstract) {
    const text = sectionText(abstract)
    if (text) sections.push({ heading: 'Abstract', text, skip: false, reason: null })
  }

  const nodes = document.querySelectorAll('section.ltx_section, section.ltx_appendix, section.ltx_bibliography, section.ltx_acknowledgements')
  for (const node of nodes) {
    // Only top-level sections; nested ones are included in their parent's text.
    if (node.parentElement?.closest('section.ltx_section, section.ltx_appendix')) continue
    const heading = cleanText(node.querySelector('h2, h3, .ltx_title')?.textContent || '')
    const cls = node.getAttribute('class') || ''
    let reason = classifyHeading(heading)
    if (cls.includes('ltx_appendix')) reason = 'appendix'
    else if (cls.includes('ltx_bibliography')) reason = 'references'
    else if (cls.includes('ltx_acknowledgements')) reason = 'acknowledgements'
    const text = sectionText(node)
    if (!text) continue
    sections.push({ heading: heading || 'Section', text, skip: !!reason, reason })
  }

  return sections.length ? { title, sections } : null
}
