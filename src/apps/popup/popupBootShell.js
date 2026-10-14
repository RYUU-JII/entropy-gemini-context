function escapeHtml(value) {
  const apostrophe = String.fromCharCode(39);
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll(apostrophe, '&#39;');
}

function renderAppRail(openDashboardLabel, dashboardHref) {
  const label = escapeHtml(openDashboardLabel);
  return `
    <aside class="popup-app-rail" aria-label="Entropy">
      <div class="popup-app-rail__utility-group"></div>
      <div class="popup-app-rail__nav-group">
        <a
          class="popup-rail-button popup-rail-button--nav popup-rail-button--dashboard"
          href="${escapeHtml(dashboardHref)}"
          target="_blank"
          rel="noreferrer"
          aria-label="${label}"
          data-tooltip="${label}"
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          <span>${label}</span>
        </a>
      </div>
    </aside>
  `;
}

function renderLoadingShell(openDashboardLabel, dashboardHref) {
  return `
    <div class="popup-shell">
      <div class="popup-layout popup-layout--supported">
        <section class="popup-card popup-site-panel popup-site-panel--loading">
          <header class="popup-site-header">
            <div class="popup-favicon popup-favicon--loading">
              <span class="popup-favicon__letter">E</span>
            </div>
            <div class="popup-site-header__copy">
              <div class="popup-loading-block popup-loading-block--title"></div>
            </div>
          </header>

          <section class="popup-readout popup-readout--loading">
            <div class="popup-readout__primary">
              <div class="popup-loading-block popup-loading-block--label"></div>
              <div class="popup-loading-block popup-loading-block--value"></div>
              <div class="popup-loading-block popup-loading-block--hint"></div>
            </div>
            <div class="popup-readout__context">
              <div class="popup-loading-block popup-loading-block--context"></div>
              <div class="popup-loading-block popup-loading-block--context"></div>
            </div>
          </section>

          <section class="popup-goal-card">
            <div class="popup-goal-card__panel popup-goal-card__panel--active">
              <div class="popup-loading-block popup-loading-block--limit-head"></div>
              <div class="popup-loading-block popup-loading-block--track"></div>
              <div class="popup-loading-block popup-loading-block--assist"></div>
            </div>
          </section>
        </section>

        ${renderAppRail(openDashboardLabel, dashboardHref)}
      </div>
    </div>
  `;
}

function renderErrorShell({
  details,
  dashboardHref,
  openDashboardLabel,
  status,
  title,
  tone,
}) {
  return `
    <div class="popup-shell">
      <div class="popup-layout popup-layout--unsupported">
        <main class="popup-card popup-site-panel popup-site-panel--notice" data-tone="${escapeHtml(tone)}">
          <header class="popup-site-header">
            <div class="popup-favicon popup-favicon--loading">
              <span class="popup-favicon__letter">E</span>
            </div>
            <div class="popup-site-header__copy">
              <div class="popup-site-header__domain">${escapeHtml(title)}</div>
            </div>
          </header>

          <section class="popup-notice" data-tone="${escapeHtml(tone)}">
            <div class="popup-notice__title">${escapeHtml(status)}</div>
            <div class="popup-notice__body">${escapeHtml(details || status)}</div>
          </section>
        </main>

        ${renderAppRail(openDashboardLabel, dashboardHref)}
      </div>
    </div>
  `;
}

export function renderPopupBootShell({
  dashboardHref = 'dashboard.html',
  details = '',
  mode = 'loading',
  openDashboardLabel = '',
  status = '',
  title = '',
  tone = 'muted',
} = {}) {
  if (mode === 'error') {
    return renderErrorShell({
      details,
      dashboardHref,
      openDashboardLabel,
      status,
      title,
      tone,
    });
  }

  return renderLoadingShell(openDashboardLabel, dashboardHref);
}
