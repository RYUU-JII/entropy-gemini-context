import { runtimeGetURL } from '../chrome/ChromeService.js';

export function resolveAudioAssetUrl(assetPath, {
  runtimeGetURLFn = runtimeGetURL,
} = {}) {
  const path = typeof assetPath === 'string' ? assetPath.trim() : '';
  if (!path) return '';
  if (typeof runtimeGetURLFn !== 'function') return path;
  return runtimeGetURLFn(path) || path;
}
