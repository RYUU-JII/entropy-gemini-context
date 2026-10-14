export function getHostname(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const hostname = typeof u.hostname === 'string' ? u.hostname.toLowerCase() : '';
    if (!hostname) return null;
    const normalized = hostname.replace(/^www\./, '').replace(/\.+$/g, '');
    return normalized || null;
  } catch {
    return null;
  }
}
