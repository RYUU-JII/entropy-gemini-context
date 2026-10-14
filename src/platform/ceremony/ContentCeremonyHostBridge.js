import {
  runtimeOnMessageAddListener,
  runtimeOnMessageRemoveListener,
} from '../chrome/ChromeService.js';
import { MESSAGE_TYPES } from '../messaging/messageTypes.js';
import {
  CEREMONY_IDS,
  isContentCeremonyId,
} from './ceremonyContracts.js';

let listener = null;
let hostModulePromise = null;

function getContentCeremonyHostModule() {
  hostModulePromise ||= import('./ContentCeremonyHost.jsx')
    .catch((error) => {
      hostModulePromise = null;
      throw error;
    });
  return hostModulePromise;
}

function normalizeCeremonyPayload(payload = {}) {
  const ceremonyId = isContentCeremonyId(payload?.ceremonyId)
    ? payload.ceremonyId
    : CEREMONY_IDS.BOOKMARK_NEUTRALIZED;

  return {
    ceremonyId,
    seed: Number.isFinite(Number(payload?.seed)) ? Number(payload.seed) : Date.now(),
    source: typeof payload?.source === 'string' && payload.source.trim()
      ? payload.source.trim()
      : 'runtime_message',
  };
}

function handleCeremonyMessage(message, _sender, sendResponse) {
  if (message?.type !== MESSAGE_TYPES.CEREMONY_PLAY) return false;

  const payload = normalizeCeremonyPayload(message?.payload);
  void getContentCeremonyHostModule()
    .then((module) => {
      const ok = module?.playContentCeremony?.(payload) === true;
      sendResponse?.({ ok });
    })
    .catch((error) => {
      console.warn('[ContentCeremonyHostBridge] Failed to load ceremony host:', error?.message || error);
      sendResponse?.({
        ok: false,
        error: error?.message || String(error || 'CEREMONY_HOST_LOAD_FAILED'),
      });
    });

  return true;
}

export function installContentCeremonyHost() {
  if (listener) return;
  listener = handleCeremonyMessage;
  runtimeOnMessageAddListener(listener);
}

export function teardownContentCeremonyHost() {
  if (listener) {
    runtimeOnMessageRemoveListener(listener);
    listener = null;
  }
  if (hostModulePromise) {
    void hostModulePromise
      .then((module) => {
        module?.teardownContentCeremonyHost?.();
      })
      .catch(() => {});
  }
}
