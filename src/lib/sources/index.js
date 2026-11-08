import { createCasperSource } from './casper.js'

/** Registry of available sources. Add new sources here. */
export function getSources() {
  return [createCasperSource()]
}
