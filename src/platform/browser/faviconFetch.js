import { runtimeGetURL } from '../chrome/ChromeService.js';
import { fetchPackagedExtensionAsset } from '../extension/packagedAssetFetch.js';
import {
  MAX_FAVICON_DATA_URL_CHARS,
  isAllowedFaviconDataUrl,
} from '../storage/assets/faviconDataUrlPolicy.js';

const MAX_FAVICON_BINARY_BYTES = 256 * 1024;
const MAX_LOCAL_FAVICON_DIMENSION = 256;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

async function blobToDataUrl(blob) {
  if (!blob?.size || blob.size > MAX_FAVICON_BINARY_BYTES) return '';
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length < 45 || bytes.length > MAX_FAVICON_BINARY_BYTES
    || !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return '';
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (header.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') return '';
  const width = header.getUint32(16);
  const height = header.getUint32(20);
  if (!width || !height || width > MAX_LOCAL_FAVICON_DIMENSION || height > MAX_LOCAL_FAVICON_DIMENSION) return '';
  // Chrome's favicon DB stores PNG bytes, but its proprietary URL loader labels
  // them image/bmp and may omit Content-Type. Validate this exact local payload
  // with the worker decoder before projecting its canonical image/png MIME.
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  try {
    if (bitmap.width !== width || bitmap.height !== height) return '';
  } finally { bitmap.close(); }
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  const dataUrl = `data:image/png;base64,${btoa(binary)}`;
  return isAllowedFaviconDataUrl(dataUrl) ? dataUrl : '';
}

// The candidate is an observation identity, never a network destination.
// Chrome's extension _favicon endpoint reads its existing local favicon DB;
// its API explicitly disables favicon-server fallback. A miss is optional.
export async function fetchFaviconDataUrl(faviconUrl, pageUrl) {
  if (typeof faviconUrl !== 'string' || !faviconUrl.trim()) return '';
  const candidate = faviconUrl.trim();
  if (candidate.toLowerCase().startsWith('data:')) {
    return candidate.length <= MAX_FAVICON_DATA_URL_CHARS && isAllowedFaviconDataUrl(candidate)
      ? candidate : '';
  }
  let page;
  let icon;
  try {
    page = new URL(pageUrl);
    icon = new URL(candidate);
  } catch {
    return '';
  }
  if (!['https:', 'http:'].includes(page.protocol) || page.username || page.password
    || !['https:', 'http:'].includes(icon.protocol) || icon.username || icon.password) return '';
  const runtimeUrl = runtimeGetURL('/');
  if (!runtimeUrl.startsWith('chrome-extension:')) return '';
  const assetUrl = runtimeGetURL(`_favicon/?pageUrl=${encodeURIComponent(page.href)}&size=64`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetchPackagedExtensionAsset(assetUrl, { runtimeUrl, signal: controller.signal });
    if (!response.ok) return '';
    return await blobToDataUrl(await response.blob());
  } catch {
    // This derived image is optional. A miss/error leaves the last committed
    // local image and explicit UI monogram intact; it never tries a remote URL.
    return '';
  } finally {
    clearTimeout(timeoutId);
  }
}
