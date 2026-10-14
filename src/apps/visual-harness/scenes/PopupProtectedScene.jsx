import React from 'react';
import { createInstance } from 'i18next';

import PopupPage from '../../../ui-kit/popup/PopupPage.jsx';
import {
  resolvePopupGoalControlState,
  resolvePopupStatusMeta,
} from '../../../lib/popup/popupPresentation.js';
import { POPUP_I18N_RESOURCES } from '../../../i18n/popupResources.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../popup/popup.css';

const POPUP_SNAPSHOT = Object.freeze({
  capturedAt: 0,
  site: Object.freeze({
    pageUrl: 'https://www.youtube.com/watch?v=entropy-visual-harness',
    hostname: 'youtube.com',
    supported: true,
  }),
  metrics: Object.freeze({
    todayMs: 42 * 60_000,
    weeklyAverageDailyMs: 58 * 60_000,
    trackedTodayMs: 120 * 60_000,
    shareOfTracked: 0.35,
  }),
  protection: Object.freeze({
    isProtected: true,
    goalMinutes: 60,
    level: 2,
    reasons: Object.freeze([]),
    activeFilters: Object.freeze([
      Object.freeze({ key: 'blur', band: 'normal', source: 'user_config' }),
    ]),
    activeArtifacts: Object.freeze([]),
    standbyArtifacts: Object.freeze(['timeAnchor']),
  }),
});

let popupTranslator = null;
let popupSceneId = null;

async function preparePopupProtectedScene({ manifest }) {
  popupSceneId = manifest.id;
  const popupI18n = createInstance();
  await popupI18n.init({
    resources: POPUP_I18N_RESOURCES,
    lng: manifest.locale,
    fallbackLng: false,
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
  });
  popupTranslator = popupI18n.getFixedT(manifest.locale, 'common');
}

function PopupProtectedScene({ signalReady }) {
  React.useEffect(() => {
    if (popupSceneId === 'popup/effects-ko') document.querySelector('.popup-effects-trigger').click();
    const frame = requestAnimationFrame(signalReady);
    return () => cancelAnimationFrame(frame);
  }, [signalReady]);
  const [isolationOpen, setIsolationOpen] = React.useState(popupSceneId === 'popup/isolation-ko');

  if (typeof popupTranslator !== 'function') {
    throw new Error('[VisualHarness] popup translator was not prepared.');
  }

  const t = popupTranslator;
  const goalMinutes = 60;
  const goalControlState = resolvePopupGoalControlState({
    snapshot: POPUP_SNAPSHOT,
    isSaving: false,
    messageCode: 'idle',
    t,
  });
  const statusMeta = resolvePopupStatusMeta({
    snapshot: POPUP_SNAPSHOT,
    goalMinutes,
    t,
  });
  const noop = () => {};

  return (
    <PopupPage
      contextDomain={POPUP_SNAPSHOT.site.hostname}
      pageUrl={POPUP_SNAPSHOT.site.pageUrl}
      canAllowCurrentSiteForSession={false}
      dashboardHref="#dashboard"
      displayDomain="youtube.com"
      goalControlState={goalControlState}
      goalMinutes={goalMinutes}
      handleAllowCurrentSiteForSession={noop}
      handleCancelIsolationPicker={() => setIsolationOpen(false)}
      handleCancelPermissionPrompt={noop}
      handleConfirmPermissionPrompt={noop}
      handleConfirmStartIsolationSession={noop}
      handleEndSpecialSession={noop}
      handleProtectSite={noop}
      handleToggleIsolationPicker={() => setIsolationOpen(true)}
      isolationPickerOpen={isolationOpen}
      isReady
      isSaving={false}
      isSpecialSessionSaving={false}
      isSupported
      message=""
      messageCode="idle"
      permissionPromptState={null}
      shareOfTracked={POPUP_SNAPSHOT.metrics.shareOfTracked}
      sitesHref="#site-rules"
      snapshot={POPUP_SNAPSHOT}
      specialSession={{ active: false, mode: null, temporaryAllowedHosts: [] }}
      specialSessionAction="idle"
      statusMeta={statusMeta}
      t={t}
      todayMs={POPUP_SNAPSHOT.metrics.todayMs}
      weeklyAverageDailyMs={POPUP_SNAPSHOT.metrics.weeklyAverageDailyMs}
    />
  );
}

export default defineVisualSceneImplementation({
  Component: PopupProtectedScene,
  prepare: preparePopupProtectedScene,
});
