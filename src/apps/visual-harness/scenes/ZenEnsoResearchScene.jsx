import React from 'react';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import ZenEnsoResearchLab from '../../../../scripts/dev/zen-enso-research/app/ZenEnsoResearchLab.jsx';

function ZenEnsoResearchScene({ signalReady }) {
  return <ZenEnsoResearchLab automated onReady={signalReady} />;
}
export default defineVisualSceneImplementation({ Component: ZenEnsoResearchScene });
