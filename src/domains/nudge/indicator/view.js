import { normalizeIndicatorConfig } from '../../settings/config/indicator.js';
import { addClass, removeClass, setAttribute, setInlineStyle, setText } from '../visual/FastStyleEngine.js';
import { createIndicatorState, mergeIndicatorState } from './model.js';
import { createIndicatorThemeAdapter } from './themeAdapter.js';
import { tRuntime } from '../../settings/i18n/runtime.js';
import { openIndicatorSiteRecord, requestIndicatorInfo, resolveLimitMinutes } from './viewHelpers.js';
import { persistNudgeIndicatorConfig } from '../nudgeSettingsClient.js';

const CARRIER_DEFAULT_MARGIN_PX = 24;
const CARRIER_VIEWPORT_MARGIN_PX = 8;
const CARRIER_DRAG_THRESHOLD_PX = 4;
const CARRIER_SNAP_DISTANCE_PX = 40;
const INDICATOR_INFO_PREFETCH_INTERVAL_MS = 15000;
const REASON_DURATION_MS = 1600;

const INDICATOR_CSS = `
:host { all: initial; --indicator-saturation-comp: calc(1 / max(var(--f-saturation, 1), 0.35)); }
.friction-carrier, .friction-attempt-reason {
  all: initial;
  position: fixed;
  z-index: 2147483646;
  box-sizing: border-box;
  max-width: calc(100vw - 32px);
  font-family: var(--indicator-theme-font-ui, var(--font-theme-ui, system-ui, sans-serif));
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--indicator-theme-text, #e3e7e7);
  filter: saturate(var(--indicator-saturation-comp, 1));
}
.friction-carrier {
  right: 24px;
  bottom: 24px;
  min-height: 44px;
  display: none;
  align-items: center;
  gap: 9px;
  padding: 8px 12px;
  border: 0;
  border-left: 2px solid var(--indicator-theme-accent, #8aad94);
  background: var(--indicator-theme-surface, rgba(15,18,20,.92));
  text-decoration: none;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}
.friction-carrier:focus-visible { outline: 2px solid var(--indicator-theme-accent); outline-offset: 3px; }
.friction-carrier.is-dragging { cursor: grabbing; }
.friction-carrier__time { font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.friction-attempt-reason {
  right: 24px;
  bottom: 76px;
  margin: 0;
  padding: 3px 7px;
  background: rgba(10,12,14,.8);
  color: white;
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 140ms ease-out, visibility 0s linear 140ms;
}
.friction-attempt-reason.is-visible { opacity: 1; visibility: visible; transition-delay: 0s; }
.friction-video-frame {
  all: initial; position: fixed; z-index: 2147483645; pointer-events: none;
  border-radius: 0; opacity: 0;
  box-shadow: inset 0 0 22px rgba(255,255,255,.12), inset 0 0 58px rgba(0,0,0,.5);
}
.friction-video-frame.is-pulsing { animation: framePulse 450ms ease-out forwards; }
:host([data-theme="zen"]) .friction-video-frame {
  box-shadow: none;
  border-bottom: 1px solid rgba(172, 176, 158, .25);
}
:host([data-theme="zen"]) .friction-video-frame::after {
  content: ''; position: absolute; left: calc(50% - 24px); bottom: 12px;
  width: 48px; height: 25px; border-radius: 49% 43% 38% 46%;
  background: radial-gradient(ellipse at 35% 25%, #73766b 0%, #41463c 40%, #22271f 85%);
  border: 1px solid rgba(206, 209, 190, .24);
  box-shadow: 0 4px 10px #0006, inset 0 1px 1px #d7dac12e;
}
:host([data-theme="zen"]) .friction-video-frame::before {
  content: ''; position: absolute; left: calc(50% - 68px); bottom: 3px;
  width: 136px; height: 12px; border: 1px solid rgba(204, 207, 185, .28);
  border-radius: 50%; box-shadow: 0 3px 0 rgba(204, 207, 185, .1);
}
:host([data-theme="zen"]) .friction-video-frame.is-pulsing::after {
  animation: tomeIshiResistance 450ms cubic-bezier(.16, .7, .3, 1) both;
}
@keyframes tomeIshiResistance {
  0% { transform: translateX(5px); } 35% { transform: translateX(-2px); } 100% { transform: translateX(0); }
}
@keyframes framePulse { 0% { opacity: 0; } 25% { opacity: 1; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .friction-attempt-reason { transition: none; }
  .friction-video-frame.is-pulsing { animation: none; opacity: .6; }
  :host([data-theme="zen"]) .friction-video-frame.is-pulsing::after { animation: none; }
}
`;

function mountIndicatorTemplate(shadow) {
  shadow.innerHTML = `
    <style>${INDICATOR_CSS}</style>
    <button class="friction-carrier" type="button">
      <span>Entropy</span><span aria-hidden="true">·</span>
      <span class="js-status"></span><span class="friction-carrier__time js-time"></span>
    </button>
    <p class="friction-attempt-reason" role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="friction-video-frame"></div>
  `;
}

const StatusIndicator = (() => {
  let host = null;
  let shadow = null;
  let carrierEl = null;
  let reasonEl = null;
  let frameEl = null;
  let state = createIndicatorState();
  let videoTarget = null;
  let frameUpdateRaf = null;
  let framePulseTimer = null;
  let reasonHideTimer = null;
  let reasonKind = null;
  let dragState = null;
  let suppressCarrierClick = false;
  let lastInfo = null;
  let infoUnavailable = false;
  let navigationFailed = false;
  let navigationPending = false;
  let infoRequest = null;
  let lastInfoFetchAt = -Infinity;
  let epoch = 0;
  const indicatorThemeAdapter = createIndicatorThemeAdapter({ getRoot: () => host });

  function hasSavedCarrierPosition(config = state.indicatorConfig) {
    return Number.isFinite(config?.positionX) && Number.isFinite(config?.positionY);
  }

  function getCarrierSize() {
    const rect = carrierEl?.getBoundingClientRect?.();
    const width = Number.isFinite(rect?.width) && rect.width > 0 ? rect.width : 220;
    const height = Number.isFinite(rect?.height) && rect.height > 0 ? rect.height : 44;
    return { width, height };
  }

  function getViewportSize() {
    const root = document?.documentElement;
    const width = Number.isFinite(root?.clientWidth) && root.clientWidth > 0
      ? root.clientWidth
      : (window.innerWidth || 0);
    const height = Number.isFinite(root?.clientHeight) && root.clientHeight > 0
      ? root.clientHeight
      : (window.innerHeight || 0);
    return { width, height };
  }

  function clampCarrierPosition(x, y) {
    const { width, height } = getCarrierSize();
    const viewport = getViewportSize();
    const viewportWidth = Math.max(width + (CARRIER_VIEWPORT_MARGIN_PX * 2), viewport.width || 0);
    const viewportHeight = Math.max(height + (CARRIER_VIEWPORT_MARGIN_PX * 2), viewport.height || 0);
    const minX = CARRIER_VIEWPORT_MARGIN_PX;
    const minY = CARRIER_VIEWPORT_MARGIN_PX;
    const maxX = Math.max(minX, viewportWidth - width - CARRIER_VIEWPORT_MARGIN_PX);
    const maxY = Math.max(minY, viewportHeight - height - CARRIER_VIEWPORT_MARGIN_PX);
    const nextX = Math.round(Math.max(minX, Math.min(maxX, Number(x) || 0)));
    const nextY = Math.round(Math.max(minY, Math.min(maxY, Number(y) || 0)));
    return { x: nextX, y: nextY };
  }

  function getDefaultCarrierPosition() {
    const { width, height } = getCarrierSize();
    const viewport = getViewportSize();
    const viewportWidth = viewport.width || (width + (CARRIER_DEFAULT_MARGIN_PX * 2));
    const viewportHeight = viewport.height || (height + (CARRIER_DEFAULT_MARGIN_PX * 2));
    return clampCarrierPosition(
      viewportWidth - width - CARRIER_DEFAULT_MARGIN_PX,
      viewportHeight - height - CARRIER_DEFAULT_MARGIN_PX,
    );
  }

  function getCarrierSnapBounds(originX, originY) {
    const { width, height } = getCarrierSize();
    const viewport = getViewportSize();
    const viewportWidth = viewport.width || (width + (CARRIER_DEFAULT_MARGIN_PX * 2));
    const viewportHeight = viewport.height || (height + (CARRIER_DEFAULT_MARGIN_PX * 2));
    const origin = clampCarrierPosition(originX, originY);
    return {
      left: clampCarrierPosition(CARRIER_DEFAULT_MARGIN_PX, origin.y).x,
      right: clampCarrierPosition(viewportWidth - width - CARRIER_DEFAULT_MARGIN_PX, origin.y).x,
      top: clampCarrierPosition(origin.x, CARRIER_DEFAULT_MARGIN_PX).y,
      bottom: clampCarrierPosition(origin.x, viewportHeight - height - CARRIER_DEFAULT_MARGIN_PX).y,
    };
  }

  function snapCarrierPositionToEdgeOrCorner(positionX, positionY) {
    const origin = clampCarrierPosition(positionX, positionY);
    const { left, right, top, bottom } = getCarrierSnapBounds(origin.x, origin.y);
    const nearLeft = Math.abs(origin.x - left) <= CARRIER_SNAP_DISTANCE_PX;
    const nearRight = Math.abs(origin.x - right) <= CARRIER_SNAP_DISTANCE_PX;
    const nearTop = Math.abs(origin.y - top) <= CARRIER_SNAP_DISTANCE_PX;
    const nearBottom = Math.abs(origin.y - bottom) <= CARRIER_SNAP_DISTANCE_PX;

    if (nearLeft && nearTop) return { x: left, y: top };
    if (nearRight && nearTop) return { x: right, y: top };
    if (nearLeft && nearBottom) return { x: left, y: bottom };
    if (nearRight && nearBottom) return { x: right, y: bottom };

    if (nearLeft) return { x: left, y: origin.y };
    if (nearRight) return { x: right, y: origin.y };
    if (nearTop) return { x: origin.x, y: top };
    if (nearBottom) return { x: origin.x, y: bottom };

    return origin;
  }

  function getCurrentCarrierPosition() {
    if (!carrierEl) return getDefaultCarrierPosition();
    const rect = carrierEl.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
      return getDefaultCarrierPosition();
    }
    return clampCarrierPosition(rect.left, rect.top);
  }

  function applyCarrierPosition(positionX, positionY) {
    if (!carrierEl) return;
    const { x, y } = clampCarrierPosition(positionX, positionY);
    setInlineStyle(carrierEl, 'left', `${x}px`);
    setInlineStyle(carrierEl, 'top', `${y}px`);
    setInlineStyle(carrierEl, 'right', 'auto');
    setInlineStyle(carrierEl, 'bottom', 'auto');
  }

  function applyCarrierPositionFromConfig() {
    if (!carrierEl) return;
    const config = state?.indicatorConfig || {};
    if (!hasSavedCarrierPosition(config)) {
      const position = getDefaultCarrierPosition();
      applyCarrierPosition(position.x, position.y);
      return;
    }
    applyCarrierPosition(config.positionX, config.positionY);
  }

  function persistCarrierPosition(positionX, positionY, { snapToEdgeOrCorner = false } = {}) {
    const clamped = clampCarrierPosition(positionX, positionY);
    const resolved = snapToEdgeOrCorner
      ? snapCarrierPositionToEdgeOrCorner(clamped.x, clamped.y)
      : clamped;

    applyCarrierPosition(resolved.x, resolved.y);

    const nextConfig = normalizeIndicatorConfig({
      ...(state?.indicatorConfig || {}),
      positionX: resolved.x,
      positionY: resolved.y,
    });
    state.indicatorConfig = nextConfig;
    persistNudgeIndicatorConfig(nextConfig).catch((error) => {
      console.warn('[Indicator] Position save failed:', error);
    });
  }

  function detachDragListeners() {
    window.removeEventListener('pointermove', handleCarrierPointerMove, true);
    window.removeEventListener('pointerup', handleCarrierPointerUp, true);
    window.removeEventListener('pointercancel', handleCarrierPointerUp, true);
  }

  function handleCarrierPointerDown(event) {
    if (!carrierEl) return;
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    if (dragState) return;

    const currentPosition = hasSavedCarrierPosition(state?.indicatorConfig)
      ? clampCarrierPosition(state.indicatorConfig.positionX, state.indicatorConfig.positionY)
      : getCurrentCarrierPosition();

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: currentPosition.x,
      originY: currentPosition.y,
      moved: false,
    };

    addClass(carrierEl, 'is-dragging');
    carrierEl.setPointerCapture?.(event.pointerId);
    detachDragListeners();
    window.addEventListener('pointermove', handleCarrierPointerMove, true);
    window.addEventListener('pointerup', handleCarrierPointerUp, true);
    window.addEventListener('pointercancel', handleCarrierPointerUp, true);
    event.stopPropagation();
  }

  function handleCarrierPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.moved && (Math.abs(deltaX) >= CARRIER_DRAG_THRESHOLD_PX || Math.abs(deltaY) >= CARRIER_DRAG_THRESHOLD_PX)) {
      dragState.moved = true;
    }
    applyCarrierPosition(dragState.originX + deltaX, dragState.originY + deltaY);
    event.preventDefault();
  }

  function handleCarrierPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const shouldPersist = !!dragState.moved;
    suppressCarrierClick = shouldPersist;
    const pointerId = dragState.pointerId;

    dragState = null;
    detachDragListeners();
    removeClass(carrierEl, 'is-dragging');
    carrierEl?.releasePointerCapture?.(pointerId);

    if (!shouldPersist) {
      return;
    }
    const nextPosition = getCurrentCarrierPosition();
    persistCarrierPosition(nextPosition.x, nextPosition.y, { snapToEdgeOrCorner: true });
    event.preventDefault();
  }

  function handleViewportResize() {
    if (!carrierEl || dragState) return;
    if (!hasSavedCarrierPosition(state?.indicatorConfig)) {
      applyCarrierPositionFromConfig();
      return;
    }
    const clamped = clampCarrierPosition(state.indicatorConfig.positionX, state.indicatorConfig.positionY);
    if (clamped.x !== state.indicatorConfig.positionX || clamped.y !== state.indicatorConfig.positionY) {
      persistCarrierPosition(clamped.x, clamped.y);
      return;
    }
    applyCarrierPosition(clamped.x, clamped.y);
  }


  function paintCarrier() {
    if (!carrierEl) return;
    carrierEl.disabled = navigationPending;
    setAttribute(carrierEl, 'aria-busy', String(navigationPending));
    carrierEl.style.display = state.indicatorConfig.enabled ? 'inline-flex' : 'none';
    if (reasonEl) setInlineStyle(reasonEl, 'bottom', state.indicatorConfig.enabled ? '76px' : '24px');
    setAttribute(carrierEl, 'aria-label', tRuntime('common:indicator.edge.open_site', { domain: location.hostname }));
    setText(shadow.querySelector('.js-status'), state.isBlocked
      ? tRuntime('common:indicator.tooltip.status_active')
      : state.isBlockedDomain ? tRuntime('common:indicator.tooltip.status_waiting')
        : tRuntime('common:indicator.status.off'));
    const dailyMs = lastInfo?.dailyMs;
    const limit = resolveLimitMinutes(state.policy, lastInfo);
    const validTime = typeof dailyMs === 'number' && Number.isFinite(dailyMs) && dailyMs >= 0;
    const usage = validTime ? tRuntime(limit > 0 ? 'common:indicator.edge.usage' : 'common:indicator.edge.usage_without_limit', {
      minutes: Math.floor(dailyMs / 60000), limit,
    }) : tRuntime(infoUnavailable ? 'common:indicator.edge.unavailable' : 'common:indicator.edge.loading');
    setText(shadow.querySelector('.js-time'), navigationFailed ? tRuntime('common:indicator.edge.open_failed') : usage);
    if (!dragState) applyCarrierPositionFromConfig();
  }

  function prefetchIndicatorInfo() {
    if (!state.indicatorConfig.enabled || infoRequest
      || Date.now() - lastInfoFetchAt < INDICATOR_INFO_PREFETCH_INTERVAL_MS) return;
    lastInfoFetchAt = Date.now();
    const requestEpoch = epoch;
    infoRequest = requestIndicatorInfo().then((info) => {
      if (requestEpoch !== epoch) return;
      if (!info || typeof info.dailyMs !== 'number' || !Number.isFinite(info.dailyMs)) {
        throw new Error('INDICATOR_USAGE_UNAVAILABLE');
      }
      lastInfo = info;
      infoUnavailable = false;
      paintCarrier();
    }).catch((error) => {
      if (requestEpoch !== epoch) return;
      lastInfo = null;
      infoUnavailable = true;
      paintCarrier();
      console.warn('[Indicator] Usage query failed:', error);
    }).finally(() => { if (requestEpoch === epoch) infoRequest = null; });
  }

  function handleCarrierClick(event) {
    if (suppressCarrierClick) {
      suppressCarrierClick = false;
      event.preventDefault();
      return;
    }
    if (navigationPending) return;
    const requestEpoch = epoch;
    navigationFailed = false;
    navigationPending = true;
    paintCarrier();
    void openIndicatorSiteRecord().catch((error) => {
      if (requestEpoch !== epoch) return;
      navigationFailed = true;
      paintCarrier();
      console.warn('[Indicator] Site record navigation failed:', error);
    }).finally(() => {
      if (requestEpoch !== epoch) return;
      navigationPending = false;
      paintCarrier();
    });
  }

  function mount() {
    if (!host && document.documentElement) {
      host = document.createElement('div');
      setAttribute(host, 'data-friction-indicator', '1');
      setAttribute(host, 'data-friction-indicator-host', '1');
      shadow = host.attachShadow({ mode: 'open' });
      mountIndicatorTemplate(shadow);
      carrierEl = shadow.querySelector('.friction-carrier');
      reasonEl = shadow.querySelector('.friction-attempt-reason');
      frameEl = shadow.querySelector('.friction-video-frame');
      carrierEl.addEventListener('pointerdown', handleCarrierPointerDown);
      carrierEl.addEventListener('click', handleCarrierClick);
      window.addEventListener('resize', handleViewportResize, { passive: true });
      indicatorThemeAdapter.attach();
      paintCarrier();
    }
    const parent = document.fullscreenElement || document.documentElement;
    if (host && host.parentElement !== parent) parent.appendChild(host);
  }

  function showAttemptReason(kind) {
    if (kind !== 'video' && kind !== 'shortform') throw new Error('INDICATOR_ATTEMPT_KIND_INVALID');
    mount();
    // Repeated attempts extend the same burst without repeating a live announcement.
    if (reasonKind !== kind || !reasonHideTimer) {
      setText(reasonEl, tRuntime(kind === 'video'
        ? 'common:indicator.feedback.video_blocked' : 'common:indicator.feedback.shortform_blocked'));
    }
    reasonKind = kind;
    addClass(reasonEl, 'is-visible');
    if (reasonHideTimer) clearTimeout(reasonHideTimer);
    reasonHideTimer = setTimeout(() => {
      reasonHideTimer = null;
      reasonKind = null;
      removeClass(reasonEl, 'is-visible');
      setText(reasonEl, '');
    }, REASON_DURATION_MS);
  }

  function clearAttemptReason(kind) {
    if (reasonKind !== kind) return;
    if (reasonHideTimer) clearTimeout(reasonHideTimer);
    reasonHideTimer = null;
    reasonKind = null;
    if (reasonEl) { removeClass(reasonEl, 'is-visible'); setText(reasonEl, ''); }
  }

  function clearFramePulse() {
    if (framePulseTimer) clearTimeout(framePulseTimer);
    framePulseTimer = null;
    if (frameEl) removeClass(frameEl, 'is-pulsing');
    if (frameUpdateRaf) cancelAnimationFrame(frameUpdateRaf);
    frameUpdateRaf = null;
  }

  function updateFramePosition() {
    if (!videoTarget || !videoTarget.isConnected || videoTarget.ownerDocument !== document) {
      setVideoTarget(null); return;
    }
    const rect = videoTarget.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 1 || rect.height <= 1) {
      setVideoTarget(null); return;
    }
    setInlineStyle(frameEl, 'left', rect.left + 'px');
    setInlineStyle(frameEl, 'top', rect.top + 'px');
    setInlineStyle(frameEl, 'width', rect.width + 'px');
    setInlineStyle(frameEl, 'height', rect.height + 'px');
    if (framePulseTimer) frameUpdateRaf = requestAnimationFrame(updateFramePosition);
  }

  function setVideoTarget(target) {
    if (videoTarget === target) return;
    clearFramePulse();
    clearAttemptReason('video');
    videoTarget = target;
  }

  function pulseVideo() {
    mount();
    if (!videoTarget || !videoTarget.isConnected) return;
    clearFramePulse();
    void frameEl.offsetWidth;
    addClass(frameEl, 'is-pulsing');
    framePulseTimer = setTimeout(clearFramePulse, 450);
    updateFramePosition();
    showAttemptReason('video');
  }

  function update(next = {}) {
    mergeIndicatorState(state, next);
    mount();
    paintCarrier();
    prefetchIndicatorInfo();
  }

  function teardown() {
    epoch += 1;
    clearFramePulse();
    if (reasonHideTimer) clearTimeout(reasonHideTimer);
    reasonHideTimer = null;
    reasonKind = null;
    detachDragListeners();
    window.removeEventListener('resize', handleViewportResize);
    indicatorThemeAdapter.detach();
    host?.remove();
    host = shadow = carrierEl = reasonEl = frameEl = null;
    videoTarget = dragState = infoRequest = lastInfo = null;
    infoUnavailable = false;
    navigationFailed = false;
    navigationPending = false;
    lastInfoFetchAt = -Infinity;
    state = createIndicatorState();
  }

  return { update, pulseVideo, setVideoTarget, showAttemptReason, clearAttemptReason, teardown };
})();

export default StatusIndicator;
