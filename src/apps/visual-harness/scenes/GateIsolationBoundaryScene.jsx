import React from 'react';

import { GateIsolationBoundarySurface } from '../../gate/GateInterstitialApp.jsx';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import '../../gate/gate.css';

export const GATE_ISOLATION_BOUNDARY_SESSION = Object.freeze({
  sessionId: 'visual-gate-isolation-boundary',
  tabId: 201,
  gateKind: 'isolation',
  hostname: 'video.example',
  themeId: 'zen',
  gatekeeperStyleVariant: 'zen',
  holdUntil: new Date(2020, 0, 1, 15, 45).getTime(),
});

function GateIsolationBoundaryDemo({ signalReady }) {
  React.useLayoutEffect(() => {
    signalReady?.();
  }, [signalReady]);

  return (
    <GateIsolationBoundarySurface
      language="en"
      session={GATE_ISOLATION_BOUNDARY_SESSION}
      onClose={() => {}}
    />
  );
}

function GateIsolationBoundaryScene({ signalReady }) {
  return <GateIsolationBoundaryDemo signalReady={signalReady} />;
}

export default defineVisualSceneImplementation({
  Component: GateIsolationBoundaryScene,
});
