import '../../../../platform/chrome/dev/reactRefreshPreamble.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ZenSolarTokenRefinementLab from './ZenSolarTokenRefinementLab.jsx';
import '@/apps/dashboard/tailwind.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ZenSolarTokenRefinementLab />
    </React.StrictMode>,
  );
}
