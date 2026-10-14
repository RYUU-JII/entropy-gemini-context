import React, { useLayoutEffect, useState } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { buildBarrierCard } from '../../dashboard/tabs/tools/artifactCards/buildBarrierCard.jsx';
import { materializeArtifactControlSurface } from '../../dashboard/tabs/tools/artifactCards/shared.jsx';
import ArtifactControlDock from '../../../themes/core/tools/ArtifactControlDock.jsx';
import { ZenArtifactControlGarden } from '../../../themes/plugins/zen/api/artifactControls.js';
import koTools from '../../../i18n/locales/ko/tools.js';
import koCommon from '../../../i18n/locales/ko/common.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../dashboard/tailwind.css';

const i18n = createInstance();
let themeId;

function Controls() {
  const [groupProtectedTabs, setGrouped] = useState(true);
  const [budget, setBudget] = useState(3);
  const [enabled, setEnabled] = useState(true);
  const [children, setChildren] = useState({ intentThreshold: true, textRhythm: false });
  const childStates = Object.fromEntries(Object.entries(children).map(([key, active]) => [key, key === 'intentThreshold' ? { enabled:active, value:'standard' } : { enabled: active }]));
  const childHandlers = Object.fromEntries(Object.keys(children).map(key => [key, {
    toggle: async active => setChildren(current => ({ ...current, [key]: active })), setValue: async () => {},
  }]));
  const card = buildBarrierCard({ shell: { canonicalId: 'barrier' }, t: i18n.getFixedT('ko', 'tools'),
    state: { themeId, artifactFamilies: { barrier: { enabled: true,
      tabManagement: { groupProtectedTabs },
      children: { ...childStates, detourSpreadGuard: { enabled, value: budget } },
    } } },
    handlers: { artifactFamilies: { barrier: { setSuspended: async () => {},
      tabManagement: { toggle: async active => setGrouped(active) },
      children: { ...childHandlers, detourSpreadGuard: { toggle: async active => setEnabled(active), setValue: async value => setBudget(value) } },
    } } },
  });
  const surface = materializeArtifactControlSurface(card.controlSurface);
  return themeId === 'zen'
    ? <ZenArtifactControlGarden rows={surface.dock.blocks.flatMap(block => block.kind === 'rows' ? block.rows : [])} />
    : <ArtifactControlDock model={surface.dock} variant={themeId} />;
}

function BarrierTabManagementScene({ signalReady }) {
  useLayoutEffect(() => {
    let active = true;
    document.fonts.ready.then(() => requestAnimationFrame(async () => {
      if (!active) return;
      const row = document.querySelector('[data-artifact-control-child-key="detourSpreadGuard"]');
      if (themeId === 'zen') {
        const summary = row?.querySelector('button[aria-expanded][aria-controls]');
        if (!summary) throw new Error('BARRIER_NUMBER_DISCLOSURE_MISSING');
        if (summary.getAttribute('aria-expanded') === 'false') summary.click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!active) return;
        if (summary.getAttribute('aria-expanded') !== 'true') throw new Error('BARRIER_NUMBER_DISCLOSURE_NOT_OPEN');
      }
      const input = row?.querySelector('input[type="number"]');
      if (!input?.getClientRects().length || input.closest('[hidden]')) throw new Error('BARRIER_NUMBER_CONTROL_NOT_VISIBLE');
      if (document.documentElement.scrollWidth > innerWidth) throw new Error('BARRIER_CONTROLS_HORIZONTAL_OVERFLOW');
      signalReady();
    }));
    return () => { active = false; };
  }, [signalReady]);
  return <I18nextProvider i18n={i18n}>
    <main className="font-sans" style={{ minHeight: '100vh', padding: '32px 16px', background: 'var(--color-surface)', color: 'var(--color-on-surface)' }}>
      <section style={{ maxWidth: 660, margin: '0 auto' }}><Controls /></section>
    </main>
  </I18nextProvider>;
}

export default defineVisualSceneImplementation({ Component: BarrierTabManagementScene, prepare: async ({ manifest }) => {
  themeId = manifest.themeId;
  await i18n.init({ lng: 'ko', fallbackLng: false, resources: { ko: { tools: koTools, common: koCommon } }, defaultNS: 'tools', interpolation: { escapeValue: false } });
} });
