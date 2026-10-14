import React, { useLayoutEffect } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { WorkspaceSpecimen } from './sitesWorkspaceFixture.jsx';
import { getThemeProfile } from '../../../themes/core/profile.js';
import { preloadThemeWidgetChunk } from '../../../themes/core/registry/index.js';
import koSites from '../../../i18n/locales/ko/sites.js';
import koCommon from '../../../i18n/locales/ko/common.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../dashboard/tailwind.css';
import '../../dashboard/tabs/sites/components/sitesWorkspace.css';

const fixtureI18n = createInstance();
let variant;
let themeId;
const AVERAGE = { averageMs: 72 * 60_000, observedDayCount: 7, windowStartDateStr: '2026-02-28', windowEndDateStr: '2026-03-06', resetHour: 4, windowDayCount: 7 };

function SitesDailyCapScene({ signalReady }) {
  useLayoutEffect(() => {
    let frame;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const workspace = document.querySelector('[data-visual-capture="daily-cap-workspace"]');
        const registry = workspace.querySelector('aside');
        const selected = workspace.querySelector('.sites-sites-workspace__selected');
        const firstRow = registry.querySelector('.sites-registry-row');
        if (!firstRow || firstRow.querySelector('button').title !== 'instagram.com') throw new Error('SITES_UNIFIED_USAGE_ORDER_INVALID');
        if (firstRow.querySelector('.sites-registry-row__usage-fill').style.width !== '100%') throw new Error('SITES_UNIFIED_USAGE_SCALE_INVALID');
        if (workspace.querySelector('[type="range"]')) throw new Error('SITES_CLOSED_POLICY_EXPOSES_SLIDER');
        const frameBox = workspace.querySelector('.sites-sites-workspace__frame').getBoundingClientRect();
        const listBox = registry.getBoundingClientRect();
        const selectedBox = selected.getBoundingClientRect();
        if (Math.abs(listBox.left - frameBox.left) > 1 || Math.abs(listBox.right - selectedBox.left) > 1) throw new Error('SITES_POLICY_RECLAIMED_WIDTH_INVALID');
        const noticeWorkspace = document.querySelector('[data-visual-capture="daily-cap-workspace-notice"]');
        if (!noticeWorkspace.querySelector('[role="alert"]')) return;
        for (const selector of ['.sites-sites-workspace__frame', '[data-sites-hud]', '[data-site-cap]', 'aside', 'main']) {
          const a = workspace.querySelector(selector).getBoundingClientRect();
          const b = noticeWorkspace.querySelector(selector).getBoundingClientRect();
          if (Math.abs(a.height - b.height) > 1 || Math.abs(a.width - b.width) > 1) throw new Error('SITES_NOTICE_CHANGED_LAYOUT');
        }
        const narrow = document.querySelector('[data-visual-capture="daily-cap-workspace-narrow"]');
        if (narrow.scrollWidth > narrow.clientWidth) throw new Error('SITES_NARROW_OVERFLOW');
        for (const scenario of ['recording-off', 'excluded']) {
          const policyWorkspace = document.querySelector(`[data-visual-capture="daily-cap-workspace-${scenario}"]`);
          if (!policyWorkspace.querySelector('[data-detail-mode="policy_only"]')) throw new Error('SITES_POLICY_ONLY_VIEW_REQUIRED');
          if (scenario === 'recording-off' && policyWorkspace.querySelector('.sites-registry-row__usage-fill')) throw new Error('SITES_DISABLED_RECORDING_HAS_USAGE_FILL');
          if (scenario === 'recording-off' && policyWorkspace.querySelector('[role="tablist"]')) throw new Error('SITES_RESTRICTED_SCOPE_HAS_REDUNDANT_FILTERS');
        }
        signalReady(); observer.disconnect();
      });
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    check();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [signalReady]);
  return <I18nextProvider i18n={fixtureI18n}>
    <main className="font-sans" data-visual-capture="daily-cap-specimens" style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 32, padding: 32, background: 'var(--color-surface)' }}>
      <div data-visual-capture="daily-cap-workspace" style={{ gridColumn: '1 / -1', height: 680 }}><WorkspaceSpecimen themeId={themeId} average={AVERAGE} variant={variant} /></div>
      {['narrow', 'empty', 'exception', 'observing', 'long', 'overflow', 'notice', 'protected-only', 'recording-off', 'excluded'].map((scenario) => <div key={scenario} data-visual-capture={`daily-cap-workspace-${scenario}`}
        style={{ gridColumn: scenario === 'narrow' ? '1' : '1 / -1', width: scenario === 'narrow' ? 360 : '100%', height: scenario === 'narrow' ? 1500 : scenario === 'notice' ? 680 : 640 }}>
        <WorkspaceSpecimen themeId={themeId} average={AVERAGE} variant={variant} scenario={scenario} />
      </div>)}
    </main>
  </I18nextProvider>;
}

export default defineVisualSceneImplementation({
  Component: SitesDailyCapScene,
  prepare: async ({ manifest }) => {
    themeId = manifest.themeId;
    variant = getThemeProfile(manifest.themeId).sites.globalCapVariant;
    await Promise.all(['SitesRegistry', 'SitesTargetPanel'].map((widget) => preloadThemeWidgetChunk(themeId, widget)));
    await fixtureI18n.init({
      lng: manifest.locale,
      resources: { ko: { sites: koSites, common: koCommon } },
      ns: ['sites', 'common'],
      defaultNS: 'sites',
      fallbackLng: false,
      interpolation: { escapeValue: false },
    });
  },
});
