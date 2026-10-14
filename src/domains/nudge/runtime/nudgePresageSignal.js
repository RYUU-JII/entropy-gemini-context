import {
  DEFAULT_NUDGE_PRESAGE_CONFIG,
  normalizeNudgePresageConfig,
} from '../../settings/config/nudgeConfig.js';
import { playSentinelFurinKoiAccept } from '../nudge/nudgeGameAudio.js';
import interventionAdmissionClient from './interventionAdmissionClient.js';
import {
  RITUAL_SURFACE_TYPES,
  claimRitualSurface,
} from './ritualSurfaceArbiter.js';

const PRESAGE_KOI_SELECTOR = '[data-entropy-sentinel-presage-koi]';
const PRESAGE_SURFACE_OWNER_ID = 'sentinel_presage_signal';
const PRESAGE_DISMISS_MS = 240;
const PRESAGE_ACTIVITY_EVENTS = Object.freeze([
  'wheel',
  'scroll',
  'keydown',
  'pointerdown',
  'touchstart',
]);

let activePresageSignal = null;
let presageRevision = 0;

function clampCount(value) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.min(6, numeric));
}

function normalizeProtocolScope(value) {
  return value === 'global' ? 'global' : 'site';
}

function resolveProtocolIntensity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0.62;
  return Math.max(0.35, Math.min(1, numeric));
}

function resolveHost(documentRef) {
  if (!documentRef || typeof documentRef.createElement !== 'function') return null;
  return documentRef.body || documentRef.documentElement || null;
}

function resolveHostStyles() {
  return [
    'position: fixed',
    'inset: 0',
    'z-index: 2147483645',
    'pointer-events: none',
    'opacity: 0',
    'transition: opacity 420ms cubic-bezier(0.22, 1, 0.36, 1)',
    'background: radial-gradient(circle at 50% 78%, rgba(8, 13, 22, 0.2), transparent 32%)',
    'mix-blend-mode: normal',
  ].join('; ');
}

function resolveKoiStyles(index, count) {
  const offset = index - ((count - 1) / 2);
  const left = 50 + offset * 9;
  const bottom = 13 + Math.abs(offset) * 2;
  const delay = index * 90;
  const rotate = offset * -8;
  return [
    'position: absolute',
    `left: ${left}%`,
    `bottom: ${bottom}%`,
    'width: 72px',
    'height: 34px',
    'border: 0',
    'padding: 0',
    'margin: 0',
    'pointer-events: auto',
    'background: transparent',
    'cursor: pointer',
    'filter: drop-shadow(0 10px 24px rgba(15, 23, 42, 0.42))',
    `transform: translate(-50%, 22px) rotate(${rotate}deg) scale(0.94)`,
    'opacity: 0',
    `transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, opacity 520ms ease-out ${delay}ms`,
  ].join('; ');
}

function resolveKoiBodyStyles() {
  return [
    'position: absolute',
    'left: 13px',
    'top: 7px',
    'width: 43px',
    'height: 20px',
    'border-radius: 52% 48% 46% 54%',
    'background: linear-gradient(90deg, rgba(9, 12, 19, 0.94), rgba(30, 41, 59, 0.9) 54%, rgba(2, 6, 23, 0.96))',
    'box-shadow: inset 9px 0 12px rgba(125, 211, 252, 0.16), inset -7px 0 10px rgba(0, 0, 0, 0.34)',
  ].join('; ');
}

function createKoiElement(documentRef, {
  protocolIntensity,
  index,
  count,
  onClick,
}) {
  const koi = documentRef.createElement('button');
  koi.type = 'button';
  koi.setAttribute('data-entropy-sentinel-presage-koi', '');
  koi.setAttribute('aria-label', 'Dismiss sentinel koi');
  koi.style.cssText = resolveKoiStyles(index, count);

  const tail = documentRef.createElement('span');
  tail.setAttribute('aria-hidden', 'true');
  tail.style.cssText = [
    'position: absolute',
    'left: 51px',
    'top: 6px',
    'width: 20px',
    'height: 22px',
    'clip-path: polygon(0 50%, 100% 0, 76% 50%, 100% 100%)',
    'background: rgba(15, 23, 42, 0.86)',
  ].join('; ');

  const body = documentRef.createElement('span');
  body.setAttribute('aria-hidden', 'true');
  body.style.cssText = resolveKoiBodyStyles();

  const eye = documentRef.createElement('span');
  eye.setAttribute('aria-hidden', 'true');
  eye.style.cssText = [
    'position: absolute',
    'left: 19px',
    'top: 12px',
    'width: 3px',
    'height: 3px',
    'border-radius: 50%',
    'background: rgba(125, 211, 252, 0.92)',
  ].join('; ');

  const ripple = documentRef.createElement('span');
  ripple.setAttribute('aria-hidden', 'true');
  ripple.style.cssText = [
    'position: absolute',
    'left: 8px',
    'right: 9px',
    'bottom: -5px',
    'height: 11px',
    'border-radius: 50%',
    'border: 1px solid',
    'border-color: rgba(125, 211, 252, 0.28)',
    `opacity: ${0.32 + protocolIntensity * 0.26}`,
    'transform: scaleX(1.18)',
  ].join('; ');

  koi.append(ripple, tail, body, eye);
  koi.addEventListener('click', onClick);
  return koi;
}

function requestVisible(windowRef, host) {
  const raf = typeof windowRef?.requestAnimationFrame === 'function'
    ? windowRef.requestAnimationFrame.bind(windowRef)
    : (callback) => windowRef?.setTimeout?.(callback, 16);
  raf(() => {
    host.style.opacity = '1';
    host.querySelectorAll(PRESAGE_KOI_SELECTOR).forEach((koi) => {
      koi.style.opacity = '1';
      koi.style.transform = koi.style.transform.replace('translate(-50%, 22px)', 'translate(-50%, 0)');
    });
  });
}

function eventTargetInsideHost(event, host) {
  const target = event?.target || null;
  if (!target) return false;
  if (target === host) return true;
  if (typeof target.nodeType !== 'number') return false;
  return host.contains(target);
}

export function dismissSentinelPresageSignal({ immediate = false } = {}) {
  presageRevision += 1;
  const signal = activePresageSignal;
  if (!signal) return false;
  activePresageSignal = null;
  signal.dismiss({ immediate });
  return true;
}

export async function showSentinelPresageSignal({
  windowRef = typeof window !== 'undefined' ? window : null,
  documentRef = typeof document !== 'undefined' ? document : null,
  protocolScope: rawProtocolScope = 'site',
  protocolIntensity: rawProtocolIntensity = 0.62,
  count: rawCount = 1,
  presageConfig = null,
  isCurrent = () => true,
} = {}) {
  const hostParent = resolveHost(documentRef);
  if (!windowRef || !hostParent) return null;

  const protocolScope = normalizeProtocolScope(rawProtocolScope);
  if (protocolScope !== 'global') return null;
  if (activePresageSignal) return null;

  const protocolIntensity = resolveProtocolIntensity(rawProtocolIntensity);
  const count = clampCount(rawCount);
  const config = normalizeNudgePresageConfig(presageConfig, {
    defaults: DEFAULT_NUDGE_PRESAGE_CONFIG,
  });
  if (config.enabled === false) return null;

  const revision = presageRevision;
  const admission = await interventionAdmissionClient.prepare({ kind: 'presage' });
  if (!admission.accepted) return null;
  if (revision !== presageRevision || !isCurrent() || documentRef.visibilityState === 'hidden' || !hostParent.isConnected) {
    interventionAdmissionClient.abort(admission.lease);
    return null;
  }

  const surfaceResult = claimRitualSurface({
    type: RITUAL_SURFACE_TYPES.PRESAGE,
    ownerId: PRESAGE_SURFACE_OWNER_ID,
    admissionLease: admission.lease,
    scope: protocolScope,
    metadata: {
      protocolScope,
      count,
    },
    onSuppress: () => removeHost(),
  });
  if (!surfaceResult.accepted) { interventionAdmissionClient.release(admission.lease); return null; }
  const surfaceClaim = surfaceResult.claim;

  const host = documentRef.createElement('div');
  host.setAttribute('data-entropy-sentinel-presage', '');
  host.setAttribute('data-entropy-sentinel-presage-scope', protocolScope);
  host.style.cssText = resolveHostStyles();

  let dismissed = false;
  let timeoutId = null;
  let removeId = null;
  let surfaceReleased = false;

  function releaseSurfaceClaim(reason) {
    if (surfaceReleased) return;
    surfaceReleased = true;
    surfaceClaim?.release?.({ reason });
  }

  function cleanupListeners() {
    PRESAGE_ACTIVITY_EVENTS.forEach((eventName) => {
      windowRef.removeEventListener(eventName, handleActivity, { capture: true });
    });
  }

  function removeHost() {
    if (activePresageSignal?.host === host) activePresageSignal = null;
    cleanupListeners();
    if (timeoutId !== null) {
      windowRef.clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (removeId !== null) {
      windowRef.clearTimeout(removeId);
      removeId = null;
    }
    host.remove();
    releaseSurfaceClaim('dismissed');
    interventionAdmissionClient.release(admission.lease);
  }

  function dismiss({ immediate = false } = {}) {
    if (dismissed) return;
    dismissed = true;
    if (activePresageSignal?.host === host) {
      activePresageSignal = null;
    }
    if (immediate) {
      removeHost();
      return;
    }
    host.style.opacity = '0';
    removeId = windowRef.setTimeout(removeHost, PRESAGE_DISMISS_MS + 40);
  }

  function handleActivity(event) {
    if (!config.dismissOnActivity || eventTargetInsideHost(event, host)) return;
    dismiss();
  }

  function handleKoiClick(event) {
    event.preventDefault();
    event.stopPropagation();
    if (config.chimeOnClick !== false) {
      playSentinelFurinKoiAccept({
        protocolScope,
        intensity: protocolIntensity,
      });
    }
    dismiss();
  }

  for (let index = 0; index < count; index += 1) {
    host.appendChild(createKoiElement(documentRef, {
      protocolIntensity,
      index,
      count,
      onClick: handleKoiClick,
    }));
  }

  try {
    hostParent.appendChild(host);
    interventionAdmissionClient.present(admission.lease);
  } catch (error) {
    removeHost();
    throw error;
  }
  PRESAGE_ACTIVITY_EVENTS.forEach((eventName) => {
    windowRef.addEventListener(eventName, handleActivity, { capture: true, passive: true });
  });
  timeoutId = windowRef.setTimeout(() => dismiss(), config.visibleMs);
  requestVisible(windowRef, host);

  activePresageSignal = {
    dismiss,
    host,
    surfaceClaim,
  };
  return activePresageSignal;
}
