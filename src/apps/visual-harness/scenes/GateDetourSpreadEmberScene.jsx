import React from 'react';

import { GateDetourSpreadDemo } from './GateDetourSpreadScene.jsx';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../gate/gate.css';

// The last beat: the horizon gone, the sleeping core left in its place.
const CLOSING_SELECTION = Object.freeze([101, 102]);

function GateDetourSpreadEmberScene({ signalReady }) {
  return (
    <GateDetourSpreadDemo
      autoSelectTabIds={CLOSING_SELECTION}
      captureAtMs={1460}
      pendingDecision="continue"
      signalReady={signalReady}
    />
  );
}

export default defineVisualSceneImplementation({
  Component: GateDetourSpreadEmberScene,
});
