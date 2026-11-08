import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'
import { cleanText } from './sections.js'

/** Generic article extraction via Readability. Returns { title, sections } or null. */
export function extractArticle(html) {
  const { document } = parseHTML(html)
  const article = new Readability(document).parse()
  if (!article) return null
  const text = cleanText(article.textContent)
  if (!text) return null
  return {
    title: article.title || '',
    sections: [{ heading: 'Article', text, skip: false, reason: null }]
  }
}
