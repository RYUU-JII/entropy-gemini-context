import React, { useEffect, useState } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ThemeAmbientPresentationProvider } from '../../../themes/core/presentation/ThemeAmbientPresentationContext.jsx';
import { resolveZenAmbientPresentation, buildZenWeatherAuthoritySnapshot } from '../../../themes/plugins/zen/api/environment.js';
import { getThemeWidget, preloadThemeWidgetChunk } from '../../../themes/core/registry/index.js';
import { ZenArtifactControlGarden } from '../../../themes/plugins/zen/api/artifactControls.js';
import { ZenBonsaiGrowthRevealCard } from '../../dashboard/progression/BonsaiGrowthReveal.jsx';
import MemoryPurgeReviewSurface from '../../dashboard/tabs/tools/components/MemoryPurgeReviewSurface.jsx';
import { buildLensCard } from '../../dashboard/tabs/tools/artifactCards/buildLensCard.jsx';
import { materializeArtifactControlSurface } from '../../dashboard/tabs/tools/artifactCards/shared.jsx';
import enMain from '../../../i18n/locales/en/main.js';
import koMain from '../../../i18n/locales/ko/main.js';
import enTools from '../../../i18n/locales/en/tools.js';
import koTools from '../../../i18n/locales/ko/tools.js';
import enCommon from '../../../i18n/locales/en/common.js';
import koCommon from '../../../i18n/locales/ko/common.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../dashboard/tailwind.css';
import '../../dashboard/tabs/main/home/homeScanWorkspace.css';

const i18n = createInstance();
let ambient;
const noAction = () => {};
const lensValues = { grayscale: 70, blur: 20, brightness: 35, contrast: 45, saturation: 60 };
const states = [
  { state: 'collecting', contentState: 'pending', observedDayCount: 2, targetDayCount: 3 },
  { state: 'ready', contentState: 'no_pressure', observedDayCount: 3, targetDayCount: 3 },
  { state: 'error', contentState: 'unavailable' },
];

function auditSmallInk(root) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const rgba = color => {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data].map((value, index) => index === 3 ? value / 255 : value);
  };
  const over = (front, back) => front.slice(0, 3).map((value, index) => value * front[3] + back[index] * (1 - front[3]));
  const luminance = rgb => rgb.map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  let minimum = Infinity;
  for (const node of root.querySelectorAll('p,span,button,label,output')) {
    if (!node.getClientRects().length || node.closest('[aria-hidden="true"],:disabled')
      || ![...node.childNodes].some(child => child.nodeType === 3 && child.textContent.trim())) continue;
    const style = getComputedStyle(node);
    if (parseFloat(style.fontSize) > 18) continue;
    const ancestors = [];
    for (let current = node; current && root.contains(current); current = current.parentElement) ancestors.unshift(current);
    let background = rgba(getComputedStyle(root).backgroundColor).slice(0, 3);
    for (const current of ancestors) background = over(rgba(getComputedStyle(current).backgroundColor), background);
    const foreground = over(rgba(style.color), background);
    const a = luminance(background), b = luminance(foreground);
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    minimum = Math.min(minimum, ratio);
    if (ratio < 4.5) throw new Error(`ZEN_TYPE_AND_INK_CONTRAST:${node.className}:${ratio.toFixed(2)}:${node.textContent.slice(0, 60)}`);
  }
  return Number(minimum.toFixed(2));
}

function LensControls() {
  const [enabled, setEnabled] = useState(Object.fromEntries(Object.keys(lensValues).map(key => [key, true])));
  const card = buildLensCard({ shell: { canonicalId: 'lens' }, t: i18n.getFixedT(i18n.language, 'tools'),
    state: { themeId: 'zen', artifactFamilies: { lens: {
      enabled: true, fullscreenVisualRelaxation: { enabled: false, eligible: true },
      children: Object.fromEntries(Object.entries(lensValues).map(([key, value]) => [key, { enabled: enabled[key], value }])),
    } } },
    handlers: { artifactFamilies: { lens: { setSuspended: noAction,
      fullscreenVisualRelaxation: { toggle: noAction },
      children: Object.fromEntries(Object.keys(lensValues).map(key => [key, {
        toggle: value => setEnabled(current => ({ ...current, [key]: value })), setValue: noAction,
      }])),
    } } },
  });
  const surface = materializeArtifactControlSurface(card.controlSurface);
  return <ZenArtifactControlGarden rows={surface.dock.blocks.flatMap(block => block.kind === 'rows' ? block.rows : [])} />;
}

function ZenTypeAndInkScene({ signalReady }) {
  const ZenPressureRail = getThemeWidget('zen', 'PressureRail');
  const ZenRhythmMarker = getThemeWidget('zen', 'RhythmMarker');
  useEffect(() => {
    let active = true;
    (async () => {
      await document.fonts.load('500 13px "Zen Korean Serif Local"', '낮 밤 분재 성장 흐름');
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!active) return;
      const root = document.querySelector('[data-zen-type-and-ink]');
      const controlRow = root.querySelector('[data-artifact-control-child-key="grayscale"]');
      const summary = controlRow?.querySelector('button[aria-expanded][aria-controls]');
      if (!summary || summary.getAttribute('aria-expanded') !== 'false') throw new Error('ZEN_TYPE_AND_INK_DISCLOSURE_NOT_READY');
      summary.focus();
      if (document.activeElement !== summary || getComputedStyle(summary).outlineStyle === 'none') {
        throw new Error('ZEN_TYPE_AND_INK_SUMMARY_FOCUS_FAILED');
      }
      summary.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!active) return;
      const control = controlRow.querySelector('input[type="range"]');
      if (summary.getAttribute('aria-expanded') !== 'true' || !control?.getClientRects().length
        || control.closest('[hidden]')) throw new Error('ZEN_TYPE_AND_INK_DISCLOSED_INPUT_NOT_READY');
      if (root.scrollWidth > root.clientWidth) throw new Error('ZEN_TYPE_AND_INK_HORIZONTAL_OVERFLOW');
      if (root.querySelectorAll('.zen-purge').length !== 2) throw new Error('ZEN_TYPE_AND_INK_REVIEW_NOT_READY');
      for (const body of root.querySelectorAll('.zen-purge__body')) {
        if (getComputedStyle(body, '::after').backgroundImage === 'none') throw new Error('ZEN_TYPE_AND_INK_REVIEW_MIST_INVALID');
      }
      for (const node of root.querySelectorAll('p,span,button,label')) {
        if (!node.getClientRects().length || !node.textContent.trim()) continue;
        if (parseFloat(getComputedStyle(node).fontSize) < 11) {
          throw new Error(`ZEN_TYPE_AND_INK_BELOW_FLOOR:${node.className}:${getComputedStyle(node).fontSize}:${node.textContent.slice(0, 80)}`);
        }
      }
      for (const button of root.querySelectorAll('button')) {
        if (!button.getClientRects().length) continue;
        if (parseFloat(getComputedStyle(button).fontSize) < 12) throw new Error('ZEN_TYPE_AND_INK_CONTROL_BELOW_CAPTION');
      }
      const koreanSerif = [...document.fonts].find(face => face.family === 'Zen Korean Serif Local');
      if (koreanSerif?.status !== 'loaded') throw new Error('ZEN_TYPE_AND_INK_SERIF_NOT_LOADED');
      const phase = root.querySelector('.zen-rhythm-marker__phase');
      if (!getComputedStyle(phase).fontFamily.includes('Zen Korean Serif Local')) throw new Error('ZEN_TYPE_AND_INK_SERIF_NOT_APPLIED');
      if (getComputedStyle(root).fontFamily.includes('Zen Korean Serif Local')) throw new Error('ZEN_TYPE_AND_INK_UI_SERIF_LEAK');
      for (const button of root.querySelectorAll('button')) {
        if (!button.getClientRects().length) continue;
        const bounds = button.getBoundingClientRect();
        if (bounds.bottom > innerHeight || bounds.right > innerWidth) throw new Error('ZEN_TYPE_AND_INK_CONTROL_CLIPPED');
      }
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced && getComputedStyle(root.querySelector('.zen-home-pending-plane')).animationName !== 'none') {
        throw new Error('ZEN_TYPE_AND_INK_REDUCED_MOTION_FAILED');
      }
      control.focus();
      if (document.activeElement !== control || control.tabIndex < 0
        || getComputedStyle(control).outlineStyle === 'none') throw new Error('ZEN_TYPE_AND_INK_FOCUS_FAILED');
      const minimumContrast = auditSmallInk(root);
      root.dataset.evidence = JSON.stringify({ locale: i18n.language, phase: ambient.phase,
        serifLoaded: true, minimumTextPx: 11, minimumControlPx: 12, reducedMotion: reduced,
        keyboardFocus: true, summaryFocus: true, disclosedChild: 'grayscale', minimumContrast });
      console.info('ZEN_TYPE_AND_INK_EVIDENCE', root.dataset.evidence);
      signalReady();
    })();
    return () => { active = false; };
  }, [signalReady]);

  return <I18nextProvider i18n={i18n}><ThemeAmbientPresentationProvider value={ambient}>
    <main data-zen-type-and-ink className="font-sans" style={{ padding: 24, background: 'var(--zen-ambient-surface)', color: 'var(--zen-ambient-text)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24 }}>
        <section style={{ minWidth: 0 }}>
          <div style={{ height: 92 }}><ZenRhythmMarker /></div>
          {states.map(readiness => <div key={readiness.state} style={{ height: 44, marginTop: 12 }}>
            <ZenPressureRail pressureSummary={{ readiness, windowDays: 7, totalMs: 0 }} frameVariant="slab-cut" />
          </div>)}
          <div style={{ position: 'relative', height: 136 }}>
            <ZenBonsaiGrowthRevealCard reveal={{ deltaDayCount: 1, fromDayCount: 2, toDayCount: 3 }} onAcknowledge={noAction} />
          </div>
          <div style={{ height: 24 }}><div className="zen-home-pending-plane" /></div>
        </section>
        <section style={{ minWidth: 0 }}><LensControls /></section>
        {['history', 'bookmark_destroy'].map(mode => <section key={mode} style={{ height: 780, minWidth: 0 }}>
          <MemoryPurgeReviewSurface themeId="zen" mode={mode}
            preview={{ loading: false, items: [{ domain: 'reading.example', historyCount: 12, bookmarkCount: 5 }, { domain: 'news.example', historyCount: 4, bookmarkCount: 2 }] }}
            onConfirm={noAction} onCancel={noAction} onBackupBookmarks={noAction} />
        </section>)}
      </div>
    </main>
  </ThemeAmbientPresentationProvider></I18nextProvider>;
}

export default defineVisualSceneImplementation({ Component: ZenTypeAndInkScene, prepare: async ({ manifest }) => {
  const night = manifest.id.includes('-night');
  ambient = resolveZenAmbientPresentation({
    solarLocationProfile: { mode: 'preset', presetId: 'seoul_kr' },
    nowMs: Date.UTC(2026, 3, 12, night ? 13 : 3), environmentMode: 'reality',
    weatherAuthority: buildZenWeatherAuthoritySnapshot({ mode: 'fixed_lab_v1', fixedCloudCover: 0.15, fixedRainIntensity: 0 }),
  });
  if (ambient.phase !== (night ? 'night' : 'day')) throw new Error('ZEN_TYPE_AND_INK_AMBIENT_PHASE_INVALID');
  for (const [key, value] of Object.entries(ambient.cssVariables)) document.body.style.setProperty(key, value);
  document.body.dataset.theme = 'zen';
  await Promise.all([
    preloadThemeWidgetChunk('zen', 'ArtifactMemoryPurgeReview'),
    preloadThemeWidgetChunk('zen', 'PressureRail'),
    preloadThemeWidgetChunk('zen', 'RhythmMarker'),
    i18n.init({ lng: manifest.locale, fallbackLng: false,
      resources: { en: { main: enMain, tools: enTools, common: enCommon }, ko: { main: koMain, tools: koTools, common: koCommon } },
      ns: ['main', 'tools', 'common'], defaultNS: 'main', fallbackNS: 'common', interpolation: { escapeValue: false } }),
  ]);
} });
