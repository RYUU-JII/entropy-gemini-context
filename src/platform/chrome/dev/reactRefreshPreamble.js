/**
 * CRX dev pages must initialize React Fast Refresh from the module graph,
 * not from HTML transform output. See `vite.config.js` for the paired config
 * that strips the HTML preamble from `vite:react-refresh*`.
 */
import '@vitejs/plugin-react/preamble';
