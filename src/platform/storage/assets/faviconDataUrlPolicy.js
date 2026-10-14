export const MAX_FAVICON_DATA_URL_CHARS = 256 * 1024;

const ALLOWED_FAVICON_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/svg+xml',
]);

export function normalizeAllowedFaviconMimeType(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().toLowerCase();
  return ALLOWED_FAVICON_MIME_TYPES.has(normalized) ? normalized : '';
}

export function isAllowedFaviconMimeType(value) {
  return !!normalizeAllowedFaviconMimeType(value);
}

export function isAllowedFaviconDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return false;
  const trimmed = dataUrl.trim();
  if (!trimmed || trimmed.length > MAX_FAVICON_DATA_URL_CHARS) return false;
  const match = /^data:([^;,]+);base64,/i.exec(trimmed);
  return !!match && isAllowedFaviconMimeType(match[1]);
}
