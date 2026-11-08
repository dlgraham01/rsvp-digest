import dns from 'node:dns/promises'
import net from 'node:net'

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    )
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase()
    if (l === '::' || l === '::1') return true
    const mapped = l.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe8') ||
      l.startsWith('fe9') || l.startsWith('fea') || l.startsWith('feb') || l.startsWith('ff')
  }
  return true
}

/**
 * Validate a user-supplied URL: http(s) only, no credentials, public IPs only.
 * Throws on rejection; returns the parsed URL.
 * Note: DNS is resolved here and again by fetch, so a rebinding race is theoretically possible.
 */
export async function assertPublicUrl(raw, lookup = dns.lookup) {
  let url
  try { url = new URL(raw) } catch { throw new Error('Invalid URL') }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed')
  if (url.username || url.password) throw new Error('Credentials in URL are not allowed')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some(a => isPrivateAddress(a.address))) {
    throw new Error('URL resolves to a non-public address')
  }
  return url
}
