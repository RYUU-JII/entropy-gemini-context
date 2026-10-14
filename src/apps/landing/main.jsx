import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/noto-sans-kr/wght.css';
import LandingApp from './LandingApp.jsx';
import '../../themes/styles/tokens/typography.css';
import './landing.css';

const LANDING_LAYOUT_TIMEOUT_MS = 5000;
const LANDING_FONT_TIMEOUT_MS = 4000;
const LANDING_BOOT_EXIT_MS = 240;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('LANDING_ROOT_ELEMENT_REQUIRED');
}

const bootElement = document.getElementById('landing-boot');
if (!bootElement) {
  throw new Error('LANDING_BOOT_ELEMENT_REQUIRED');
}

function withTimeout(promise, timeoutMs, timeoutCode) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

function waitForLandingLayoutReady() {
  return new Promise((resolve) => {
    document.addEventListener('entropy:landing-layout-ready', () => {
      resolve();
    }, { once: true });
  });
}

async function waitForFontReadiness() {
  if (!document.fonts) {
    document.documentElement.dataset.landingFontReadiness = 'unsupported';
    console.warn('[landing boot] FontFaceSet is unavailable; using the platform font stack.');
    return 'unsupported';
  }

  try {
    const canonicalFontRequests = [
      document.fonts.load('400 1rem "App Sans Local"', 'ENTROPY'),
    ];

    if (document.documentElement.lang === 'ko') {
      canonicalFontRequests.push(
        document.fonts.load('400 1rem "Noto Sans KR Variable"', '한글'),
      );
    }

    await withTimeout(
      Promise.all([
        ...canonicalFontRequests,
        document.fonts.ready,
      ]),
      LANDING_FONT_TIMEOUT_MS,
      'LANDING_FONT_READINESS_TIMEOUT',
    );

    if (!document.fonts.check('400 1rem "App Sans Local"', 'ENTROPY')) {
      throw new Error('LANDING_CANONICAL_FONT_UNAVAILABLE');
    }

    if (
      document.documentElement.lang === 'ko'
      && !document.fonts.check('400 1rem "Noto Sans KR Variable"', '한글')
    ) {
      throw new Error('LANDING_KOREAN_FONT_UNAVAILABLE');
    }

    document.documentElement.dataset.landingFontReadiness = 'ready';
    return 'ready';
  } catch (error) {
    document.documentElement.dataset.landingFontReadiness = 'failed';
    throw new Error('LANDING_CANONICAL_FONT_READINESS_FAILED', { cause: error });
  }
}

function waitForStableLayout() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function revealLanding(fontReadiness) {
  rootElement.setAttribute('aria-busy', 'false');
  rootElement.dataset.landingReady = 'true';
  document.documentElement.dataset.landingBoot = 'ready';
  document.dispatchEvent(new CustomEvent('entropy:landing-ready', {
    detail: Object.freeze({ fontReadiness }),
  }));

  window.setTimeout(() => bootElement.remove(), LANDING_BOOT_EXIT_MS);
}

function failLandingBoot(error) {
  rootElement.setAttribute('aria-busy', 'false');
  document.documentElement.dataset.landingBoot = 'failed';
  const errorElement = document.getElementById('landing-boot-error');
  if (!errorElement) {
    throw new Error('LANDING_BOOT_ERROR_ELEMENT_REQUIRED', { cause: error });
  }
  bootElement.setAttribute('aria-hidden', 'false');
  errorElement.hidden = false;
  console.error('[landing boot] The application did not reach its first stable frame.', error);
}

const reactRoot = ReactDOM.createRoot(rootElement, {
  onRecoverableError(error) {
    document.documentElement.dataset.landingReactReadiness = 'recovered';
    console.error('[landing boot] React recovered from a render error.', error);
  },
});
const landingLayoutReady = waitForLandingLayoutReady();

reactRoot.render(
  <React.StrictMode>
    <LandingApp />
  </React.StrictMode>,
);

void (async () => {
  try {
    await withTimeout(
      landingLayoutReady,
      LANDING_LAYOUT_TIMEOUT_MS,
      'LANDING_LAYOUT_READINESS_TIMEOUT',
    );
    const fontReadiness = await waitForFontReadiness();
    await waitForStableLayout();
    revealLanding(fontReadiness);
  } catch (error) {
    failLandingBoot(error);
  }
})();
