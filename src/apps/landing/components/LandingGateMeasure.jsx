import React from 'react';

function requireUnit(value, field) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`LANDING_GATE_MEASURE_${field}_INVALID`);
  }
  return value;
}

export default function LandingGateMeasure({ copy, gate }) {
  if (!gate || typeof gate !== 'object') {
    throw new Error('LANDING_GATE_MEASURE_STATE_REQUIRED');
  }
  const fill = requireUnit(gate.fillProgress, 'FILL');
  const strike = requireUnit(gate.strikeProgress, 'STRIKE');
  const release = requireUnit(gate.releaseProgress, 'RELEASE');
  const label = release > 0.7
    ? copy.gateReleased
    : strike > 0.08
      ? copy.gateStrike
      : copy.gateWaiting;

  return (
    <div
      className="landing-gate-measure"
      data-gate-phase={gate.phase}
      style={{
        '--landing-gate-fill': fill,
        '--landing-gate-strike': strike,
        '--landing-gate-release': release,
      }}
    >
      <span className="landing-gate-measure__line" aria-hidden="true">
        <i />
      </span>
      <p aria-live="polite">{label}</p>
    </div>
  );
}
