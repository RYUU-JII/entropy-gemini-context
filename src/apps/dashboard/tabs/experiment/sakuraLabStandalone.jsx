import '../../../../platform/chrome/dev/reactRefreshPreamble.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import ZenSakuraVisualRefinementLab from './ZenSakuraVisualRefinementLab.jsx';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <ZenSakuraVisualRefinementLab />
        </React.StrictMode>,
    );
}
