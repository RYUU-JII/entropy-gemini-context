import { getExtensionApi } from '../../../extension/extensionApi.js';

function getChromeStorageApi() {
  const extensionApi = getExtensionApi();
  if (extensionApi?.storage) return extensionApi.storage;

  try {
    const chromeApi = globalThis?.chrome;
    if (chromeApi?.storage && typeof chromeApi.storage === 'object') {
      return chromeApi.storage;
    }
  } catch (_error) {
    // Fall through to browser below.
  }

  try {
    const browserApi = globalThis?.browser;
    if (browserApi?.storage && typeof browserApi.storage === 'object') {
      return browserApi.storage;
    }
  } catch (_error) {
    // No extension storage API is available.
  }

  return null;
}

export function addChromeStorageChangedListener(listener) {
  if (typeof listener !== 'function') return false;
  const storageApi = getChromeStorageApi();
  if (!storageApi?.onChanged?.addListener) return false;
  storageApi.onChanged.addListener(listener);
  return true;
}

export function removeChromeStorageChangedListener(listener) {
  if (typeof listener !== 'function') return false;
  const storageApi = getChromeStorageApi();
  if (!storageApi?.onChanged?.removeListener) return false;
  storageApi.onChanged.removeListener(listener);
  return true;
}
