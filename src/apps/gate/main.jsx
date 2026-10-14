import '../../platform/chrome/dev/reactRefreshPreamble.js';
import React from 'react';
import ReactDOM from 'react-dom/client';

import '../../themes/styles/tokens/typography.css';
import './gate.tailwind.css';
import './gate.css';
import '../../i18n/config.js';
import GateInterstitialApp from './GateInterstitialApp.jsx';

function getOrCreateRoot() {
  const existing = document.getElementById('root');
  if (existing) {
    return existing;
  }

  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  return root;
}

ReactDOM.createRoot(getOrCreateRoot()).render(
  <React.StrictMode>
    <GateInterstitialApp />
  </React.StrictMode>
);
