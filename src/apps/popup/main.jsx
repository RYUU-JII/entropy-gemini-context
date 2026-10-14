import '../../platform/chrome/dev/reactRefreshPreamble.js';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { tRuntime } from '../../domains/settings/i18n/popupRuntime.js';
import { runtimeGetURL } from '../../platform/chrome/popupBrowserClient.js';
import { renderPopupBootShell } from './popupBootShell.js';

function getOrCreateRoot() {
  const existing = document.getElementById('root');
  if (existing) return existing;

  const created = document.createElement('div');
  created.id = 'root';
  document.body.appendChild(created);
  return created;
}

function renderFallback(rootEl, details = tRuntime('common:popup.fallback.unknown_error')) {
  rootEl.innerHTML = renderPopupBootShell({
    dashboardHref: runtimeGetURL('src/pages/dashboard.html'),
    details,
    mode: 'error',
    openDashboardLabel: tRuntime('common:popup.actions.open_dashboard'),
    status: tRuntime('common:popup.fallback.description'),
    title: tRuntime('common:popup.fallback.title'),
    tone: 'alert',
  });
}

async function bootPopup() {
  const rootEl = getOrCreateRoot();
  rootEl.innerHTML = renderPopupBootShell({
    dashboardHref: runtimeGetURL('src/pages/dashboard.html'),
    openDashboardLabel: tRuntime('common:popup.actions.open_dashboard'),
  });

  try {
    const [, { initializeDocumentTheme }, { default: PopupApp }] = await Promise.all([
      import('../../i18n/popupConfig.js'),
      import('../../themes/core/documentTheme.js'),
      import('./PopupApp.jsx'),
    ]);
    initializeDocumentTheme();
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <PopupApp />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('[Popup] Bootstrap failed:', error);
    const message =
      error && typeof error === 'object' && 'message' in error
        ? error.message
        : tRuntime('common:popup.fallback.bootstrap_failed');
    renderFallback(rootEl, message);
  }
}

bootPopup();
