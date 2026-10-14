import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import ScheduleRhythmWorkspace from '../../dashboard/tabs/schedule/components/ScheduleRhythmWorkspace.jsx';
import { addScheduleBlock, normalizeSchedule, removeScheduleBlock } from '../../dashboard/tabs/schedule/scheduleModel.js';
import { getScheduleVisualPolicy } from '../../../themes/core/scheduleVisualPolicy.js';
import koSchedule from '../../../i18n/locales/ko/schedule.js';
import '../../dashboard/tailwind.css';
import '../../dashboard/tabs/schedule/scheduleWorkspace.css';

const fixtureI18n = createInstance();
let sceneManifest;

function ScheduleEditorScene({ signalReady }) {
  const rootRef = useRef(null);
  const policy = getScheduleVisualPolicy(sceneManifest.themeId);
  const [schedule, setSchedule] = useState(() => normalizeSchedule({
    schemaVersion: 1, days: [1, 2, 3, 4, 5], startMin: 0, endMin: 1440,
    blocks: sceneManifest.id.endsWith('/empty') ? [] : [{
      id: 'evening', name: sceneManifest.id.includes('/options') ? '몰입의 시간' : '저녁의 여백',
      days: [1, 2, 3, 4, 5], intent: sceneManifest.id.includes('/options') ? 'isolation' : 'relaxation',
      startMin: sceneManifest.id.endsWith('/wrapped') ? 180 : 1200,
      endMin: sceneManifest.id.endsWith('/wrapped') ? 300 : 1350,
    }],
  }).schedule);
  const [draft, setDraft] = useState(null);
  const [selected, setSelected] = useState(sceneManifest.id.endsWith('/empty') ? null : 'evening');
  const [undo, setUndo] = useState(null);
  const t = fixtureI18n.getFixedT('ko', 'schedule');
  const handlers = useMemo(() => ({
    onCommit: (next) => { setUndo({ schedule, selected }); setSchedule(next); setDraft(null); },
    onDraftChange: setDraft,
    onSelectBlock: setSelected,
    onClearSelection: () => setSelected(null),
    onRemoveBlock: (id) => { setUndo({ schedule, selected }); setSchedule(removeScheduleBlock(schedule, id)); setSelected(null); },
    onAddBlock: (options) => { const result = addScheduleBlock(schedule, options); setUndo({ schedule, selected }); setSchedule(result.schedule); setSelected(result.blockId); return result; },
    onUndo: () => { setSchedule(undo.schedule); setSelected(undo.selected); setUndo(null); },
  }), [schedule, selected, undo]);
  useLayoutEffect(() => {
    let frame = requestAnimationFrame(() => {
      if (sceneManifest.id.includes('/options')) rootRef.current.querySelector('.schedule-editor-options').click();
      if (sceneManifest.id.endsWith('/start-focused')) rootRef.current.querySelector('[data-schedule-time-endpoint="start"]').focus();
      if (sceneManifest.id.endsWith('/invalid')) {
        const input = rootRef.current.querySelector('[data-schedule-time-endpoint="end"]');
        input.focus();
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '25:70');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        frame = requestAnimationFrame(() => {
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          frame = requestAnimationFrame(finish);
        });
        return;
      }
      frame = requestAnimationFrame(finish);
    });
    function finish() {
      if (document.documentElement.scrollWidth > window.innerWidth) throw new Error('SCHEDULE_VISUAL_HORIZONTAL_OVERFLOW');
      const editor = rootRef.current.querySelector('[data-schedule-workbench]');
      const inspector = editor.querySelector('.schedule-editor-inspector-content:not([hidden])');
      if (inspector) {
        const rect = inspector.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) throw new Error('SCHEDULE_VISUAL_OPTIONS_CLIPPED');
      }
      for (const control of editor.querySelectorAll('input, button')) {
        if (!control.getClientRects().length) continue;
        const rect = control.getBoundingClientRect();
        if (rect.left < 0 || rect.right > window.innerWidth) throw new Error('SCHEDULE_VISUAL_CONTROL_CLIPPED');
      }
      const field = rootRef.current.querySelector('[data-schedule-time-field]').getBoundingClientRect();
      for (const block of rootRef.current.querySelectorAll('[data-schedule-block-id]')) {
        const rect = block.getBoundingClientRect();
        if (Math.abs(rect.top - field.top) > 2 || Math.abs(rect.bottom - field.bottom) > 2) {
          throw new Error('SCHEDULE_VISUAL_BLOCK_HIT_HEIGHT_INCOMPLETE');
        }
      }
      signalReady();
    }
    return () => cancelAnimationFrame(frame);
  }, [signalReady]);
  return <I18nextProvider i18n={fixtureI18n}>
    <main ref={rootRef} className="flex h-screen flex-col bg-background text-on-surface" style={{ fontFamily: policy.typography.body }}>
      <header className="flex h-[5.5rem] shrink-0 items-center px-6" style={{ borderBottom: `1px solid ${policy.tokens.stageEdge}` }}>
        <h1 className="text-[2rem] font-light" style={{ fontFamily: policy.typography.title }}>{t('header.title_zen')}</h1>
      </header>
      <ScheduleRhythmWorkspace activeSchedule={draft || schedule} selectedBlockId={selected} handlers={handlers}
        canUndo={undo !== null} visualTokens={policy.tokens} typography={policy.typography} recipes={policy.recipes}
        timelinePolicy={policy.timeline} resetHour={4} nowTs={new Date(2026, 9, 1, 17, 40).getTime()}
        dayLabels={['일', '월', '화', '수', '목', '금', '토']} t={t}
        currentStatus={{ label: t('header.state_protected'), detail: t('header.base_always'), color: policy.tokens.inkMuted }}
        allowedUrls={['docs.google.com', 'github.com', 'notion.so']} onManageSites={() => {}}
        notificationControl={{ ensurePermission: async () => true }} />
    </main>
  </I18nextProvider>;
}

export default defineVisualSceneImplementation({
  Component: ScheduleEditorScene,
  prepare: async ({ manifest }) => {
    sceneManifest = manifest;
    await fixtureI18n.init({ lng: 'ko', resources: { ko: { schedule: koSchedule } }, ns: ['schedule'],
      defaultNS: 'schedule', fallbackLng: false, interpolation: { escapeValue: false } });
  },
});
