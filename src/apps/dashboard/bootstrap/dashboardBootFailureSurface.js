import { tDashboardRuntime as tRuntime } from '../../../domains/settings/i18n/dashboardRuntime.js';
import { reportDashboardBootRecoverySurfaceReady } from './bootEvents.js';

// The React host/i18next/App stages may fail before a React error boundary can
// mount. This error-only surface owns no settings reads, defaults, or writes.
export function mountDashboardBootFailureSurface(rootElement) {
  if (!(rootElement instanceof HTMLElement)) {
    throw new Error('DASHBOARD_BOOT_RECOVERY_ROOT_REQUIRED');
  }
  const surface = document.createElement('main');
  surface.dataset.dashboardBootRecovery = 'error';
  Object.assign(surface.style, {
    minHeight: '100vh', padding: '48px', background: '#101414', color: '#f5f5f5',
    fontFamily: 'system-ui, sans-serif', boxSizing: 'border-box',
  });
  const title = document.createElement('h1');
  title.textContent = tRuntime('common:dashboard_boot_recovery.failed_title');
  const message = document.createElement('p');
  message.setAttribute('role', 'alert');
  message.textContent = tRuntime('common:dashboard_boot_recovery.failed_body');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = tRuntime('common:dashboard_boot_recovery.retry');
  retry.addEventListener('click', () => window.location.reload());
  surface.append(title, message, retry);
  rootElement.replaceChildren(surface);
  reportDashboardBootRecoverySurfaceReady('boot_failed');
}
