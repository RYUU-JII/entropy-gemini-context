import React from 'react';

export default function LandingDebugHud({ snapshot, enabled }) {
  if (!enabled || !snapshot) return null;
  return (
    <output className="landing-debug-hud" aria-label="Landing scene diagnostics">
      <span>{snapshot.phase}</span>
      <span>scroll {snapshot.scrollProgress.toFixed(3)}</span>
      <span>world {snapshot.globalProgress.toFixed(3)}</span>
      <span>phase {snapshot.phaseProgress.toFixed(3)}</span>
      <span>gate {snapshot.shishiGate.phase}</span>
      <span>pressure {snapshot.scrollPressure.toFixed(2)}</span>
      <span>still {snapshot.stillnessProgress.toFixed(2)}</span>
      <span>night {snapshot.environment.nightDepth.toFixed(2)}</span>
      <span>{snapshot.motionMode}</span>
    </output>
  );
}
