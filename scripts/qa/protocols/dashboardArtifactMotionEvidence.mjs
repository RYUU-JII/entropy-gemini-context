export function assertDashboardArtifactMotion(result) {
  const { family, before, after } = result;
  const fail = code => {
    const error = new Error(`${code}:${family}`);
    error.diagnostic = result;
    throw error;
  };
  if (after.engineId !== before.engineId || !before.loopRunning || !after.loopRunning
    || after.frameCount <= before.frameCount) fail('QA_ARTIFACT_MOTION_FROZEN');

  if (family === 'flare') {
    const first = before.presentation, last = after.presentation;
    if (!['live', 'settle'].includes(last?.simulationMode)
      || first?.simulationMode !== last.simulationMode
      || !Number.isFinite(first.simulationTimeMs) || !Number.isFinite(last.simulationTimeMs)
      || !Array.isArray(first.angles) || !Array.isArray(last.angles)) {
      fail('QA_ARTIFACT_MOTION_EVIDENCE_INVALID');
    }
    if (last.simulationTimeMs <= first.simulationTimeMs) fail('QA_ARTIFACT_MOTION_FROZEN');
    // Canonical settle has zero wind: a pendulum already at rest need not move.
    // Live wind must still move the actual pose; clock progress alone is not proof.
    const pose = value => JSON.stringify([value.angles, value.hanger, value.striker, value.paper]);
    if (last.simulationMode === 'live' && pose(first) === pose(last)) fail('QA_ARTIFACT_MOTION_FROZEN');
  } else if (JSON.stringify(after.presentation) === JSON.stringify(before.presentation)) {
    fail('QA_ARTIFACT_MOTION_FROZEN');
  }
  return result;
}
