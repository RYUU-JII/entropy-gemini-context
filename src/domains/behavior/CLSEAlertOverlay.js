import {
  runtimeOnMessageAddListener,
  runtimeOnMessageRemoveListener,
} from '../../platform/chrome/ChromeService.js';
import { getRuntimeLanguage, tRuntime } from '../settings/i18n/runtime.js';

const OVERLAY_ID = 'clse-alert-overlay';
const STYLE_ID = 'clse-alert-style';
const DEFAULT_HIDE_MS = 6000;

let overlay = null;
let cardEl = null;
let titleEl = null;
let detailEl = null;
let severityEl = null;
let timeEl = null;
let barEl = null;
let closeEl = null;
let hideTimer = null;
let initialized = false;
let staticCopyLanguage = '';
let messageListener = null;
let domReadyListener = null;

const TYPE_LABEL_KEYS = Object.freeze({
  TAB_SPIKE: 'common:clse_alert.type.tab_spike',
  NAV_SPIKE: 'common:clse_alert.type.nav_spike',
  SCROLL_SPIKE: 'common:clse_alert.type.scroll_spike',
  COMPOSITE_SPIKE: 'common:clse_alert.type.composite_spike',
  SUSTAINED_LOAD_START: 'common:clse_alert.type.sustained_load_start',
  SUSTAINED_LOAD_ESCALATION: 'common:clse_alert.type.sustained_load_escalation',
  PAGE_LOOP_DETECTED: 'common:clse_alert.type.page_loop_detected',
  SITE_LOOP_DETECTED: 'common:clse_alert.type.site_loop_detected',
});

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${OVERLAY_ID} {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 2147483647;
  pointer-events: none;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

#${OVERLAY_ID} .clse-alert-card {
  min-width: 260px;
  max-width: 360px;
  pointer-events: none;
  background: rgba(12, 16, 20, 0.92);
  color: #e8f0f2;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-left: 4px solid var(--clse-alert-accent, #79d2b2);
  border-radius: 12px;
  padding: 12px 14px 12px 14px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  opacity: 0;
  visibility: hidden;
  transform: translateY(6px);
  transition: opacity 180ms ease, transform 180ms ease;
}

#${OVERLAY_ID}[data-visible="1"] .clse-alert-card {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  pointer-events: auto;
}

#${OVERLAY_ID}[data-severity="low"] { --clse-alert-accent: #7fb4ff; }
#${OVERLAY_ID}[data-severity="mid"] { --clse-alert-accent: #ffd166; }
#${OVERLAY_ID}[data-severity="high"] { --clse-alert-accent: #ff7b7b; }

#${OVERLAY_ID} .clse-alert-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

#${OVERLAY_ID} .clse-alert-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

#${OVERLAY_ID} .clse-alert-close {
  border: none;
  background: transparent;
  color: rgba(232, 240, 242, 0.7);
  font-size: 16px;
  cursor: pointer;
}

#${OVERLAY_ID} .clse-alert-close:hover {
  color: #ffffff;
}

#${OVERLAY_ID} .clse-alert-detail {
  font-size: 12px;
  color: rgba(232, 240, 242, 0.78);
  margin-bottom: 10px;
}

#${OVERLAY_ID} .clse-alert-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(232, 240, 242, 0.6);
}

#${OVERLAY_ID} .clse-alert-bar {
  margin-top: 8px;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  overflow: hidden;
}

#${OVERLAY_ID} .clse-alert-bar-fill {
  height: 100%;
  width: 0%;
  background: var(--clse-alert-accent, #79d2b2);
  transition: width 180ms ease;
}

@media (prefers-reduced-motion: reduce) {
  #${OVERLAY_ID} .clse-alert-card,
  #${OVERLAY_ID} .clse-alert-bar-fill {
    transition: none;
  }
}
`.trim();
  const target = document.head || document.documentElement;
  target.appendChild(style);
}

function ensureOverlay() {
  if (overlay) return;
  const container = document.createElement('div');
  container.id = OVERLAY_ID;

  const card = document.createElement('div');
  card.className = 'clse-alert-card';

  const header = document.createElement('div');
  header.className = 'clse-alert-header';

  const title = document.createElement('div');
  title.className = 'clse-alert-title';
  title.textContent = '';

  const close = document.createElement('button');
  close.className = 'clse-alert-close';
  close.type = 'button';
  close.setAttribute('aria-label', '');
  close.textContent = '×';
  close.addEventListener('click', (event) => {
    event.stopPropagation();
    hideAlert();
  });

  header.appendChild(title);
  header.appendChild(close);

  const detail = document.createElement('div');
  detail.className = 'clse-alert-detail';
  detail.textContent = '';

  const meta = document.createElement('div');
  meta.className = 'clse-alert-meta';

  const severity = document.createElement('div');
  severity.textContent = '';

  const time = document.createElement('div');
  time.textContent = '';

  meta.appendChild(severity);
  meta.appendChild(time);

  const bar = document.createElement('div');
  bar.className = 'clse-alert-bar';

  const barFill = document.createElement('div');
  barFill.className = 'clse-alert-bar-fill';
  bar.appendChild(barFill);

  card.appendChild(header);
  card.appendChild(detail);
  card.appendChild(meta);
  card.appendChild(bar);
  container.appendChild(card);

  overlay = container;
  cardEl = card;
  titleEl = title;
  detailEl = detail;
  severityEl = severity;
  timeEl = time;
  barEl = barFill;
  closeEl = close;
  setOverlayVisibility(false);

  const target = document.body || document.documentElement;
  target.appendChild(container);
  applyStaticCopy();
}

function setOverlayVisibility(isVisible) {
  if (!overlay) return;
  overlay.dataset.visible = isVisible ? '1' : '0';
  overlay.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
  if (!cardEl) return;
  if (isVisible) {
    cardEl.removeAttribute('inert');
    return;
  }
  cardEl.setAttribute('inert', '');
}

function resolveTypeLabel(type) {
  const normalizedType = String(type || '').trim();
  if (!normalizedType) {
    return tRuntime('common:clse_alert.title_default');
  }
  const key = TYPE_LABEL_KEYS[normalizedType];
  return key ? tRuntime(key) : normalizedType;
}

function applyStaticCopy() {
  staticCopyLanguage = getRuntimeLanguage();
  if (titleEl) {
    titleEl.textContent = tRuntime('common:clse_alert.title_default');
  }
  if (detailEl) {
    detailEl.textContent = tRuntime(
      'common:clse_alert.monitoring'
    );
  }
  if (severityEl) {
    severityEl.textContent = tRuntime('common:clse_alert.severity', { value: 0 });
  }
  if (timeEl) {
    timeEl.textContent = tRuntime('common:clse_alert.just_now');
  }
  if (closeEl) {
    closeEl.setAttribute('aria-label', tRuntime('common:clse_alert.dismiss'));
  }
}

function syncStaticCopyLanguage() {
  const nextLanguage = getRuntimeLanguage();
  if (!nextLanguage || nextLanguage === staticCopyLanguage) return;
  applyStaticCopy();
}

function formatDetail(alert) {
  const data = alert?.data || {};
  const parts = [];
  if (typeof data.value === 'number') {
    parts.push(
      tRuntime('common:clse_alert.detail.value', { value: Math.round(data.value) })
    );
  }
  if (typeof data.repeat_count === 'number') {
    parts.push(
      tRuntime('common:clse_alert.detail.repeat_count', { count: data.repeat_count })
    );
  }
  if (typeof data.window_count === 'number') {
    parts.push(
      tRuntime('common:clse_alert.detail.window_count', { count: data.window_count })
    );
  }
  if (typeof data.duration_ms === 'number') {
    const seconds = Math.round(data.duration_ms / 1000);
    parts.push(
      tRuntime('common:clse_alert.detail.duration', { seconds })
    );
  }
  if (Array.isArray(data.components) && data.components.length) {
    const value = data.components.join(', ');
    parts.push(
      tRuntime('common:clse_alert.detail.components', { value })
    );
  }
  return parts.length
    ? parts.join(' · ')
    : tRuntime('common:clse_alert.detail.fallback');
}

function updateSeverity(severity) {
  const pct = Math.round(Math.max(0, Math.min(1, severity || 0)) * 100);
  if (severityEl) {
    severityEl.textContent = tRuntime('common:clse_alert.severity', { value: pct });
  }
  if (barEl) barEl.style.width = `${pct}%`;

  if (!overlay) return;
  if (pct >= 75) overlay.dataset.severity = 'high';
  else if (pct >= 45) overlay.dataset.severity = 'mid';
  else overlay.dataset.severity = 'low';
}

function showAlert(alert) {
  if (!alert) return;
  ensureStyle();
  ensureOverlay();
  syncStaticCopyLanguage();

  const type = alert.type || 'ALERT';
  const label = resolveTypeLabel(type);
  if (titleEl) titleEl.textContent = label;
  if (detailEl) detailEl.textContent = formatDetail(alert);

  if (timeEl) {
    if (alert.ts) {
      const ts = new Date(alert.ts);
      const language = getRuntimeLanguage();
      const locale = language === 'ko' ? 'ko-KR' : 'en-US';
      timeEl.textContent = ts.toLocaleTimeString(locale);
    } else {
      timeEl.textContent = tRuntime('common:clse_alert.just_now');
    }
  }

  updateSeverity(Number(alert.severity) || 0);

  setOverlayVisibility(true);

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    hideAlert();
  }, DEFAULT_HIDE_MS);
}

function hideAlert() {
  if (!overlay) return;
  setOverlayVisibility(false);
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

export function initCLSEAlertOverlay() {
  if (initialized) return;
  initialized = true;

  domReadyListener = () => {
    ensureStyle();
    ensureOverlay();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', domReadyListener, { once: true });
  } else {
    domReadyListener();
  }

  messageListener = (message) => {
    if (message?.type !== 'CLSE_ALERT') return;
    showAlert(message.payload);
  };

  runtimeOnMessageAddListener(messageListener);
}

export function teardownCLSEAlertOverlay() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (domReadyListener) {
    document.removeEventListener('DOMContentLoaded', domReadyListener);
    domReadyListener = null;
  }
  if (messageListener) {
    runtimeOnMessageRemoveListener(messageListener);
    messageListener = null;
  }
  overlay?.remove?.();
  document.getElementById(STYLE_ID)?.remove?.();
  overlay = null;
  cardEl = null;
  titleEl = null;
  detailEl = null;
  severityEl = null;
  timeEl = null;
  barEl = null;
  closeEl = null;
  staticCopyLanguage = '';
  initialized = false;
}
