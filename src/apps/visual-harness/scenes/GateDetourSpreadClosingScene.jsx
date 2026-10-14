import React from 'react';

import { GateDetourSpreadDemo } from './GateDetourSpreadScene.jsx';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../gate/gate.css';

/*
 * Opening and consumption stills from the submit-triggered reveal sequence.
 *
 * The sequence is 1600ms and in the product it only ever runs behind a submit,
 * after which the surface is replaced — so without a scene that starts already
 * pending and holds the capture to a chosen millisecond, nothing about it is
 * verifiable and any regression in it is silent.
 *
 * The frames are picked for what they have to prove: that submit reveals the
 * previously hidden void, that the tabs leave by
 * being drawn out along their own radius rather than by fading, and that what
 * the horizon retracts into is the sleeping core.
 */
const CLOSING_SELECTION = Object.freeze([101, 102]);

function GateDetourSpreadClosingScene({ signalReady }) {
  return (
    <GateDetourSpreadDemo
      autoSelectTabIds={CLOSING_SELECTION}
      captureAtMs={760}
      pendingDecision="continue"
      signalReady={signalReady}
    />
  );
}

export default defineVisualSceneImplementation({
  Component: GateDetourSpreadClosingScene,
});

export const opening = defineVisualSceneImplementation({
  Component: function GateDetourSpreadOpeningScene({ signalReady }) {
    return <GateDetourSpreadDemo autoSelectTabIds={CLOSING_SELECTION} captureAtMs={320}
      language="ko" pendingDecision="continue" signalReady={signalReady} />;
  },
});
