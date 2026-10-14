import React from 'react';
import { createRoot } from 'react-dom/client';

import {
  runtimeOnMessageAddListener,
  runtimeOnMessageRemoveListener,
} from '../chrome/ChromeService.js';
import { MESSAGE_TYPES } from '../messaging/messageTypes.js';
import {
  CEREMONY_IDS,
  isContentCeremonyId,
} from './ceremonyContracts.js';
import CeremonyOverlay from './CeremonyOverlay.jsx';

const HOST_ID = 'entropy-content-ceremony-host';

let listener = null;
let host = null;
let root = null;
let activeRequest = null;
let serial = 0;

function ensureHost() {
  if (typeof document === 'undefined') return null;
  if (host?.isConnected && root) return { host, root };

  host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('aria-hidden', 'true');
    const target = document.documentElement || document.body;
    target.appendChild(host);
  }
  root = createRoot(host);
  return { host, root };
}

function clearCeremony(requestId) {
  if (activeRequest?.requestId !== requestId) return;
  activeRequest = null;
  if (root) {
    root.render(null);
  }
}

export function playContentCeremony({
  ceremonyId = CEREMONY_IDS.BOOKMARK_NEUTRALIZED,
  seed = Date.now(),
  source = 'content_runtime',
} = {}) {
  if (!isContentCeremonyId(ceremonyId)) {
    return false;
  }
  const container = ensureHost();
  if (!container?.root) return false;

  serial += 1;
  const requestId = serial;
  activeRequest = {
    requestId,
    ceremonyId,
    seed: Number.isFinite(Number(seed)) ? Number(seed) : Date.now(),
    source,
  };

  container.root.render(
    <CeremonyOverlay
      key={`${ceremonyId}:${requestId}`}
      active
      ceremonyId={ceremonyId}
      seed={activeRequest.seed}
      onComplete={() => clearCeremony(requestId)}
    />,
  );
  return true;
}

function handleCeremonyMessage(message, _sender, sendResponse) {
  if (message?.type !== MESSAGE_TYPES.CEREMONY_PLAY) return false;
  const ok = playContentCeremony({
    ceremonyId: message?.payload?.ceremonyId,
    seed: message?.payload?.seed,
    source: message?.payload?.source || 'runtime_message',
  });
  sendResponse?.({ ok });
  return false;
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
  activeRequest = null;
  if (root) {
    root.render(null);
    root.unmount();
  }
  root = null;
  host?.remove?.();
  host = null;
}
