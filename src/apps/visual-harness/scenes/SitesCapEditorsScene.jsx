import React, { useLayoutEffect, useRef, useState } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import SitesHud from '../../dashboard/tabs/sites/components/SitesHud.jsx';
import SitesSiteCap from '../../dashboard/tabs/sites/components/SitesSiteCap.jsx';
import { getThemeProfile } from '../../../themes/core/profile.js';
import koSites from '../../../i18n/locales/ko/sites.js';
import koCommon from '../../../i18n/locales/ko/common.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../dashboard/tailwind.css';

const i18n = createInstance();
let variant;
let narrow;
const AVERAGE = { averageMs: 72 * 60000, observedDayCount: 7, windowStartDateStr: '2026-02-28', windowEndDateStr: '2026-03-06', resetHour: 4, windowDayCount: 7 };
const RECORDING = { configuredMode: 'all_sites_minimal', effectiveScope: 'all_sites', reason: 'recording', globalCapAvailable: true, excludedProtectedCount: 0 };
const CASES = [
  { id: 'ready', goal: 120 }, { id: 'draft', goal: 120, draft: 180 }, { id: 'unlimited', goal: 0 },
  { id: 'below-average', goal: 60 }, { id: 'equal-average', goal: 72 }, { id: 'average-overflow', goal: 180, average: 570 },
  { id: 'collecting', goal: 120, average: null }, { id: 'partial', goal: 120, observed: 2 }, { id: 'saving', goal: 120, draft: 180, phase: 'saving' },
  { id: 'error', goal: 120, draft: 180, phase: 'error' }, { id: 'site-increase', site: true, goal: 60, draft: 120 },
  { id: 'site-overflow', site: true, goal: 600 }, { id: 'site-unset', site: true, goal: 0 }, { id: 'details', goal: 120, details: true },
];
function Specimen({ item }) {
  const root = useRef(null);
  const [stage, setStage] = useState(0);
  const [goal, setGoal] = useState(item.goal);
  useLayoutEffect(() => {
    const host = root.current;
    const readout = host.querySelector('.sites-cap-readout');
    if (stage === 0) {
      readout.querySelector('button[aria-expanded]').click(); setStage(1); return;
    }
    const form = host.querySelector('form');
    if (!form) throw new Error('CAP_EDITOR_DID_NOT_OPEN');
    if (stage === 1) {
      if (item.draft !== undefined) {
        // Deterministic specimen preparation, not evidence of trusted QA input.
        const input = form.querySelector('input[type="number"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(item.draft));
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (item.details) form.querySelector('details').open = true;
      setStage(2);
    } else if (stage === 2) {
      if (item.phase) form.requestSubmit();
      setStage(3);
    }
  }, [item, stage]);
  const save = async (minutes) => {
    if (item.phase === 'saving') return new Promise(() => {});
    if (item.phase === 'error') throw new Error('QA_CAP_SAVE_FAILURE');
    setGoal(minutes);
  };
  return <section ref={root} data-cap-specimen={item.id} data-prepared={stage === 3}
    style={{ height: item.details ? 680 : 500, padding: narrow ? '0 18px' : 0, minWidth: 0 }}>
    <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--color-on-surface-muted)' }}>{item.id}</p>
    {item.site ? <SitesSiteCap admissionStatus="ready" capAvailability={{ available: true, reason: 'available' }} domain="youtube.com" type="blocked" goalMinutes={goal} onGoalChange={async (_domain, minutes) => { await save(minutes); return { ok: true, appliedMinutes: minutes }; }} />
      : <SitesHud admissionStatus="ready" recording={RECORDING} variant={variant} totalExposure={42 * 60000} globalGoal={goal} onGlobalGoalChange={save}
        globalExposureAverage={{ ...AVERAGE, averageMs: item.average === null ? null : item.average !== undefined ? item.average * 60000 : AVERAGE.averageMs,
          observedDayCount: item.average === null ? 0 : item.observed !== undefined ? item.observed : 7 }} />}
  </section>;
}
function SitesCapEditorsScene({ signalReady }) {
  const cases = narrow ? [CASES[1]] : CASES;
  useLayoutEffect(() => {
    let frame;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        for (const item of cases) {
          const root = document.querySelector(`[data-cap-specimen="${item.id}"]`);
          if (root.dataset.prepared !== 'true') return;
          const readout = root.querySelector('.sites-cap-readout');
          const form = root.querySelector('form');
          if (!form || !readout.contains(form)) throw new Error('CAP_EDITOR_MISSING');
          if (item.phase && readout.dataset.savePhase !== item.phase) return;
          const box = form.getBoundingClientRect();
          if (box.left < 0 || box.right > window.innerWidth || box.bottom > window.innerHeight || box.top < 0) throw new Error('CAP_EDITOR_OUTSIDE_VIEWPORT');
          if (getComputedStyle(form).position === 'fixed' || getComputedStyle(form).position === 'absolute'
            || root.querySelector('[role="dialog"], [type="range"]')) throw new Error('CAP_EDITOR_INLINE_FLOW_REQUIRED');
          const scope = readout.querySelector('.sites-cap-readout__scope').getBoundingClientRect();
          if (box.top < scope.bottom) throw new Error('CAP_EDITOR_OVERLAPS_SCOPE');
          const input = form.querySelector('input[type="number"]');
          if (!input || !input.labels.length || !input.hasAttribute('aria-describedby')) throw new Error('CAP_EDITOR_NUMERIC_ACCESSIBILITY');
          if (item.draft !== undefined && input.value !== String(item.draft)) throw new Error('CAP_EDITOR_DRAFT_INVALID');
          if (item.site && input.hasAttribute('max')) throw new Error('CAP_EDITOR_SITE_MAX_INVALID');
          if (!item.site && input.max !== '480') throw new Error('CAP_EDITOR_GLOBAL_MAX_INVALID');
          if (item.average === null && form.querySelector('.sites-cap-editor__average strong')?.textContent
            !== i18n.t('sites_hud.average_collecting')) throw new Error('CAP_EDITOR_FABRICATED_AVERAGE');
          if (item.id === 'site-increase' && !form.textContent.includes(i18n.t('target_panel.goal_increase_cap_notice',
            { cap: 30, requested: 120, applied: 90 }))) throw new Error('CAP_EDITOR_POLICY_PREVIEW_INVALID');
          const inputBox = input.getBoundingClientRect();
          for (const button of form.querySelectorAll('button')) {
            const action = button.getBoundingClientRect();
            if (action.left < inputBox.right && action.right > inputBox.left
              && action.top < inputBox.bottom && action.bottom > inputBox.top) throw new Error('CAP_EDITOR_ACTIONS_OVERLAP');
          }
        }
        if (narrow && document.activeElement?.type !== 'number') throw new Error('CAP_EDITOR_INITIAL_FOCUS_INVALID');
        signalReady(); observer.disconnect();
      });
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    check(); return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [signalReady, cases]);
  return <I18nextProvider i18n={i18n}><main className="font-sans" style={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 24, padding: narrow ? '16px 0' : 24, background: 'var(--color-surface)', minHeight: '100vh' }}>
    {cases.map((item) => <Specimen key={item.id} item={item} />)}
  </main></I18nextProvider>;
}
export default defineVisualSceneImplementation({ Component: SitesCapEditorsScene, prepare: async ({ manifest }) => {
  variant = getThemeProfile(manifest.themeId).sites.globalCapVariant;
  narrow = manifest.id.includes('narrow');
  await i18n.init({ lng: 'ko', fallbackLng: false, resources: { ko: { sites: koSites, common: koCommon } }, defaultNS: 'sites', interpolation: { escapeValue: false } });
} });
