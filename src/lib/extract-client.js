/**
 * Client for the /api/extract and /api/pdf endpoints, plus helpers that turn
 * extracted sections into RSVP text.
 *
 * Section shape: { heading, text, skip, reason }
 */
import { parseFile } from './file-parsers.js'

export async function fetchExtraction(url, fetchImpl = (...a) => fetch(...a)) {
  const res = await fetchImpl(`/api/extract?url=${encodeURIComponent(url)}`)
  let data = null
  try { data = await res.json() } catch { /* handled below */ }
  if (!res.ok) throw new Error(data?.error || `Extraction failed (${res.status})`)
  if (data.kind === 'pdf') return loadPdf(data, fetchImpl)
  return data
}

async function loadPdf(info, fetchImpl, parse = parseFile) {
  const res = await fetchImpl(`/api/pdf?url=${encodeURIComponent(info.pdfUrl)}`)
  if (!res.ok) throw new Error('Could not download PDF (it may be too large)')
  const blob = await res.blob()
  const file = new File([blob], 'document.pdf', { type: 'application/pdf' })
  const text = await parse(file)
  return { ...info, sections: splitPdfBackMatter(text) }
}

const BACK_MATTER = /\b(Acknowledg(?:e)?ments?|References|Bibliography)\b/g

/**
 * PDF text has no structure, so heuristically cut at the first
 * Acknowledgements/References heading in the second half of the text.
 * Returns sections so the user can re-include the cut part.
 */
export function splitPdfBackMatter(text) {
  const half = Math.floor(text.length / 2)
  BACK_MATTER.lastIndex = half
  const m = BACK_MATTER.exec(text)
  if (!m) return [{ heading: 'Document', text, skip: false, reason: null }]
  return [
    { heading: 'Document', text: text.slice(0, m.index).trim(), skip: false, reason: null },
    { heading: `${m[1]} and after`, text: text.slice(m.index).trim(), skip: true, reason: 'back matter (guessed)' }
  ].filter(s => s.text)
}

export function countWords(text) {
  const t = (text || '').trim()
  return t ? t.split(/\s+/).length : 0
}

/** Join the sections the user kept. */
export function sectionsToText(sections) {
  return sections.filter(s => !s.skip).map(s => s.text).join('\n\n')
}
