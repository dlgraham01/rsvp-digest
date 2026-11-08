const SKIP_PATTERNS = [
  [/^(references?|bibliography|works cited)$/i, 'references'],
  [/^acknowledg(e)?ments?$/i, 'acknowledgements'],
  [/^(appendix|appendices|supplementary( material)?)\b/i, 'appendix'],
  [/^(author contributions?|funding|conflicts? of interest|ethics statement|reproducibility statement|broader impacts?)$/i, 'back matter']
]

/** Returns a skip reason for headings that are usually not worth reading, else null. */
export function classifyHeading(heading) {
  // Strip a leading section number like "7" or "7.1" (not letters, which may be real words).
  const h = (heading || '').replace(/^\d+(\.\d+)*\.?\s+/, '').trim()
  for (const [re, reason] of SKIP_PATTERNS) {
    if (re.test(h)) return reason
  }
  return null
}

/** Collapse whitespace and tidy punctuation spacing left by DOM text extraction. */
export function cleanText(s) {
  return (s || '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +([,.;:!?])/g, '$1')
    .trim()
}
