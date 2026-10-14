import React from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import FurinInstallationPresentation from '../../dashboard/guidance/FurinInstallationPresentation.jsx';
import koGuidance from '../../../i18n/locales/ko/guidance.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';

const fixtureI18n = createInstance();
const INSTALLATION_FIXTURE = Object.freeze({ globalGoalMinutes: 60 });
let motionCapture = false;
const noop = () => {};

// Actual production modal, native theme renderer and clock; the supplied
// boundary is a render fixture. No Guidance service, claim or settings write.
function FurinInstallationScene({ signalReady }) {
  return <I18nextProvider i18n={fixtureI18n}>
    <FurinInstallationPresentation installation={INSTALLATION_FIXTURE} replay
      onPresented={motionCapture ? noop : signalReady}
      onComplete={motionCapture ? signalReady : noop} onDismiss={noop}/>
  </I18nextProvider>;
}

export default defineVisualSceneImplementation({
  Component: FurinInstallationScene,
  prepare: async ({ manifest }) => {
    motionCapture = manifest.id.endsWith('-motion');
    await fixtureI18n.init({ lng: manifest.locale, resources: { ko: { guidance: koGuidance } },
      ns: ['guidance'], defaultNS: 'guidance', fallbackLng: false,
      interpolation: { escapeValue: false } });
  },
});
