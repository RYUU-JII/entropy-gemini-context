const toURL = (value, base = undefined) => new URL(String(value || ''), base);

export function parse(value) {
  const url = toURL(value, 'http://entropy.invalid');
  return {
    protocol: url.protocol,
    slashes: String(value || '').startsWith('//') || url.href.startsWith(`${url.protocol}//`),
    auth: url.username || url.password
      ? `${decodeURIComponent(url.username)}${url.password ? `:${decodeURIComponent(url.password)}` : ''}`
      : null,
    host: url.host,
    port: url.port,
    hostname: url.hostname,
    hash: url.hash,
    search: url.search,
    query: url.search ? url.search.slice(1) : null,
    pathname: url.pathname,
    path: `${url.pathname}${url.search}`,
    href: url.href,
  };
}

export function format(value) {
  if (value instanceof URL) return value.href;
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const protocol = value.protocol ? String(value.protocol) : '';
  const slashes = value.slashes || value.host ? '//' : '';
  const auth = value.auth ? `${encodeURIComponent(String(value.auth))}@` : '';
  const host = value.host || [
    value.hostname || '',
    value.port ? `:${value.port}` : '',
  ].join('');
  const pathname = value.pathname || '';
  const search = value.search || (
    value.query && typeof value.query === 'string'
      ? `?${value.query}`
      : ''
  );
  const hash = value.hash || '';
  return `${protocol}${slashes}${auth}${host}${pathname}${search}${hash}`;
}

export function resolve(from, to) {
  return toURL(to, toURL(from, 'http://entropy.invalid')).href;
}
