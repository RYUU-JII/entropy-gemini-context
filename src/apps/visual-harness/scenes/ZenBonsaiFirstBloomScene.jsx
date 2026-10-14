import React from 'react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { ZenBonsaiFirstBloomPreview } from '../../../themes/plugins/zen/api/bonsaiFirstBloomPreview.js';
import BonsaiFirstBloomPrompt from '../../dashboard/progression/BonsaiFirstBloomPrompt.jsx';
import koMain from '../../../i18n/locales/ko/main.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';

const fixtureI18n = createInstance();
const renderPrompt = props => <BonsaiFirstBloomPrompt {...props} />;

function ZenBonsaiFirstBloomScene({ signalReady }) {
  return <I18nextProvider i18n={fixtureI18n}>
    <ZenBonsaiFirstBloomPreview renderPrompt={renderPrompt} onReady={signalReady} />
  </I18nextProvider>;
}

export default defineVisualSceneImplementation({
  Component: ZenBonsaiFirstBloomScene,
  prepare: async () => {
    await fixtureI18n.init({ lng: 'ko', resources: { ko: { main: koMain } },
      ns: ['main'], defaultNS: 'main', fallbackLng: false,
      interpolation: { escapeValue: false } });
  },
});
