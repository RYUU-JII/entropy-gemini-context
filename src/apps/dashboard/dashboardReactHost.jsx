import React from 'react';
import ReactDOM from 'react-dom/client';

import './tailwind.css';

export function renderDashboardApp(AppComponent) {
  if (typeof AppComponent !== 'function') {
    throw new Error('DASHBOARD_APP_COMPONENT_INVALID');
  }
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Dashboard root element (#root) not found.');
  }
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <AppComponent />
    </React.StrictMode>,
  );
}
