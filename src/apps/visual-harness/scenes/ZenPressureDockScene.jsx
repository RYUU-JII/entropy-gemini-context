import React, { useEffect, useRef } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import Favicon from '../../../ui-kit/Favicon.jsx';

import ZenHomePressureDock from '../../dashboard/tabs/main/home/ZenHomePressureDock.jsx';
import { resolveZenHomeCompositionLayoutFrame } from '../../dashboard/tabs/main/home/zenHomeCompositionLayoutFrame.js';
import { getThemeWidget, preloadThemeWidgetChunk } from '../../../themes/core/registry/index.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import enMain from '../../../i18n/locales/en/main.js';
import enCommon from '../../../i18n/locales/en/common.js';
import '../../dashboard/tailwind.css';
import '../../dashboard/tabs/main/home/homeScanWorkspace.css';
import './zenPressureDockScene.css';

const SITES = [
  ['video.example', 0.36, 'protected'],
  ['news.example', 0.24, 'managed_allowed'],
  ['a-very-long-domain-name.for-pressure-layout-verification.example', 0.16, 'unmanaged'],
  ['four.example', 0.1, 'protected'],
  ['five.example', 0.06, 'managed_allowed'],
].map(([domain, pressureShare, policyDisposition], index) => ({
  domain, pressureShare, policyDisposition,
  visibleRank: index + 1,
  pressureRank: index + 1,
  weightedPressureMs: pressureShare * 36_000_000,
  rawWindowMs: (140 - index * 20) * 60_000,
}));
const PRESSURE_SUMMARY = {
  mode: 'recent-pressure', windowDays: 7, totalMs: 36_000_000, protectedMs: 16_560_000,
  readiness: { state: 'ready', contentState: 'pressure', observedDayCount: 7, targetDayCount: 3 },
};
const SPECIMENS = [
  { id: 'wide', label: 'Landscape · five sites + remainder', width: 780, height: 160, mode: 'landscape', domain: 'news.example' },
  { id: 'portrait', label: 'Portrait desktop · local container width', width: 640, height: 180, mode: 'portrait-desktop', domain: SITES[2].domain },
  { id: 'compact', label: 'Compact · long domain', width: 330, height: 210, mode: 'portrait-compact', domain: SITES[2].domain },
  { id: 'short', label: 'Limited height · in-place domain action', width: 330, height: 120, mode: 'portrait-compact', domain: SITES[2].domain },
  { id: 'dominant', label: '80% dominant · smallest site hovered', width: 780, height: 160, mode: 'landscape', domain: SITES[4].domain, shares: [.8,.08,.04,.02,.01] },
  { id: 'extreme', label: '96% dominant · hard favicon floor at 330px', width: 330, height: 190, mode: 'portrait-compact', domain: SITES[4].domain, shares: [.96,.02,.008,.006,.004] },
];
const RASTER_FIXTURES = [];
const pressureI18n = createInstance();
const rect = (left, top, right, bottom) => ({ left, top, right, bottom, width: right - left, height: bottom - top });

function PressureSpecimen({ specimen }) {
  const railSlotRef = useRef(null);
  const { width, height, mode } = specimen;
  const sites = specimen.shares ? SITES.map((site, i) => ({...site,
    pressureShare: specimen.shares[i], weightedPressureMs: specimen.shares[i] * PRESSURE_SUMMARY.totalMs,
  })) : SITES;
  // Explicit component inputs, not a substituted Dashboard/Worker scene.
  const landscape = mode === 'landscape';
  const frame = resolveZenHomeCompositionLayoutFrame({
    layoutMode: mode,
    stageRect: rect(0, 0, width + 324, landscape ? height : height + 320),
    pondRect: rect(0, 0, width, height - 34),
    pressureRailRect: rect(0, height - 34, width, height),
    bonsaiRect: landscape
      ? rect(width + 24, 0, width + 300, height - 34)
      : rect(0, height, width, height + 300),
  });
  return (
    <section className="pressure-dock-specimen">
      <h2>{specimen.label}</h2>
      <div
        className="zen-home-stage pressure-dock-specimen__surface"
        data-ui-layout={mode}
        data-visual-capture={`pressure-dock-${specimen.id}`}
        style={{ width, height }}
      >
        <ZenHomePressureDock
          layoutFrame={frame.pressure}
          railSlotRef={railSlotRef}
          RailComponent={getThemeWidget('zen', 'PressureRail')}
          railProps={{
            pressureSummary: PRESSURE_SUMMARY,
            pressureSites: sites,
            hoveredDomain: specimen.domain,
            onSelectDomain: () => {},
            frameVariant: 'slab-cut',
          }}
        />
      </div>
    </section>
  );
}

function ZenPressureDockScene({ signalReady }) {
  useEffect(() => {
    let cancelled = false;
    document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(async () => {
      if (cancelled) return;
      for (const { id } of SPECIMENS) {
        const surface = document.querySelector(`[data-visual-capture="pressure-dock-${id}"]`);
        const actions = [...surface.querySelectorAll('[data-testid="pressure-domain-action"]')];
        const revealed = actions.filter(action => action.dataset.revealed === 'true');
        if (revealed.length !== 1 || actions.some(action => !action.getAttribute('aria-label')?.includes(action.dataset.domain))) {
          throw new Error(`ZEN_PRESSURE_DOMAIN_ACTION_ACCESSIBILITY_INVALID:${id}`);
        }
        const action = revealed[0];
        const button = action.getBoundingClientRect();
        const cell = action.closest('[data-pressure-target="site"]').getBoundingClientRect();
        if (button.width < 24 || button.height < 24 || button.left < cell.left || button.right > cell.right
          || button.top < cell.top || button.bottom > cell.bottom || action.disabled) {
          throw new Error(`ZEN_PRESSURE_DOMAIN_ACTION_OUTSIDE_ALLOCATION:${id}`);
        }
        const focusAction = actions.find(candidate => candidate !== action);
        focusAction.focus({ preventScroll: true });
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (cancelled) return;
        if (focusAction.dataset.revealed !== 'true'
          || surface.querySelectorAll('[data-testid="pressure-domain-action"][data-revealed="true"]').length !== 1) {
          throw new Error(`ZEN_PRESSURE_DOMAIN_ACTION_FOCUS_INVALID:${id}`);
        }
        focusAction.blur();
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (cancelled) return;
        const data = surface.querySelector('[data-testid="pressure-segments"]').getBoundingClientRect();
        const segments = [...surface.querySelectorAll('.zen-pressure-segment-cell, [data-pressure-target="other"]')];
        if (segments.some(segment => segment.getBoundingClientRect().width < 31.9)
          || Math.abs(segments.reduce((sum, segment) => sum + segment.getBoundingClientRect().width, 0) - data.width) > 1) {
          throw new Error(`ZEN_PRESSURE_FAVICON_FLOOR_INVALID:${id}`);
        }
        for (const favicon of surface.querySelectorAll('.zen-pressure-segment-favicon > div')) {
          const icon = favicon.getBoundingClientRect();
          const cell = favicon.closest('.zen-pressure-segment-cell').getBoundingClientRect();
          if (Math.abs(icon.width - 24) > .1 || icon.left < cell.left + 3.9 || icon.right > cell.right - 3.9
            || icon.top < cell.top + 4.9 || icon.bottom > cell.bottom - 4.9) throw new Error(`ZEN_PRESSURE_FAVICON_INSET_INVALID:${id}`);
        }
      }
      signalReady();
    })));
    return () => { cancelled = true; };
  }, [signalReady]);
  return (
    <I18nextProvider i18n={pressureI18n}>
    <main className="pressure-dock-specimens" data-visual-capture="pressure-dock-specimens">
      <section className="pressure-dock-specimen">
        <h2>Raster specimen · old 18px framed / proposed 24px unframed · local synthetic sources</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 36, height: 34, background: 'var(--color-surface-sunken)' }}>
          <Favicon domain="raster-old.example" size={18} sourceCandidates={[RASTER_FIXTURES[0]]} imgClassName="p-[1px]" />
          <Favicon domain="raster-new.example" size={24} sourceSize={64} unframed sourceCandidates={[RASTER_FIXTURES[1]]} />
        </div>
      </section>
      {SPECIMENS.map((specimen) => <PressureSpecimen key={specimen.id} specimen={specimen} />)}
    </main>
    </I18nextProvider>
  );
}

export default defineVisualSceneImplementation({
  Component: ZenPressureDockScene,
  prepare: async ({ manifest }) => {
    RASTER_FIXTURES.length = 0;
    for (const size of [16, 64]) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#24475c'; ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = '#f3ebe0'; ctx.lineWidth = size / 10;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, size * .28, -.2, Math.PI * 1.8); ctx.stroke();
      ctx.fillStyle = '#cc8655'; ctx.fillRect(size * .58, size * .18, size * .12, size * .12);
      RASTER_FIXTURES.push(canvas.toDataURL('image/png'));
    }
    await Promise.all([
      preloadThemeWidgetChunk('zen', 'PressureRail'),
      pressureI18n.init({
        lng: manifest.locale,
        resources: { en: { main: enMain, common: enCommon } },
        ns: ['main', 'common'],
        defaultNS: 'main',
        fallbackNS: 'common',
        fallbackLng: false,
        interpolation: { escapeValue: false },
      }),
    ]);
  },
});
