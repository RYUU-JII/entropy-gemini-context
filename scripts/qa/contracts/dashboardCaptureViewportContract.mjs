export const DASHBOARD_CAPTURE_VIEWPORTS = Object.freeze({
  'desktop-low': Object.freeze({ width: 1440, height: 720, deviceScaleFactor: 1 }),
  'desktop-wide': Object.freeze({ width: 1784, height: 849, deviceScaleFactor: 1 }),
  'desktop-retina': Object.freeze({ width: 1784, height: 849, deviceScaleFactor: 2 }),
  'desktop-fractional': Object.freeze({ width: 1537, height: 867, deviceScaleFactor: 1.25 }),
  'desktop-compact': Object.freeze({ width: 1280, height: 849, deviceScaleFactor: 1 }),
  'portrait-narrow': Object.freeze({ width: 560, height: 960, deviceScaleFactor: 1 }),
  'portrait-desktop': Object.freeze({ width: 1080, height: 1920, deviceScaleFactor: 1 }),
  'desktop-landscape': Object.freeze({ width: 2200, height: 849, deviceScaleFactor: 1 }),
});
export const DASHBOARD_CAPTURE_VIEWPORT_NAMES = Object.freeze(Object.keys(DASHBOARD_CAPTURE_VIEWPORTS));
export const DEFAULT_DASHBOARD_CAPTURE_VIEWPORT = 'desktop-wide';

export function resolveDashboardCaptureViewport(name) {
  if (!Object.hasOwn(DASHBOARD_CAPTURE_VIEWPORTS, name)) {
    throw new Error(`QA_DASHBOARD_CAPTURE_VIEWPORT_INVALID:${String(name)}`);
  }
  return DASHBOARD_CAPTURE_VIEWPORTS[name];
}

export function matchesDashboardCaptureViewport(snapshot, viewport) {
  return snapshot?.viewport?.width === viewport.width
    && snapshot?.viewport?.height === viewport.height
    && snapshot?.viewport?.deviceScaleFactor === viewport.deviceScaleFactor;
}

const nullableNumber = (value) => Number.isFinite(value) ? value : null;

export function isCurrentDashboardPondViewport(snapshot, metrics) {
  const canvas = snapshot?.pondCanvas;
  const viewport = metrics?.viewport;
  if (!canvas?.rect || !viewport || !Number.isFinite(metrics.sampleFrames)) return false;
  const width = Math.round(canvas.rect.width), height = Math.round(canvas.rect.height);
  return width > 0 && height > 0
    && viewport.width === width && viewport.height === height
    && viewport.dpr === snapshot.viewport?.deviceScaleFactor
    && viewport.pixelWidth === canvas.width && viewport.pixelHeight === canvas.height
    && Math.abs(metrics.sceneLayout?.aspect - width / height) < 1e-6;
}
const firstFrameIdentity = (snapshot) => snapshot?.pondAck ? {
  mountId: snapshot.pondAck.mountId,
  ackElapsedMs: snapshot.pondAck.ackElapsedMs,
  sinceWorkerStartMs: snapshot.pondAck.sinceWorkerStartMs,
} : null;

export function buildDashboardResizeEvidence({
  before, after, from, to, pageTargetId, zenMainProfile,
  metricsBefore, metricsAfter,
}) {
  const beforeIdentity = firstFrameIdentity(before);
  const afterIdentity = firstFrameIdentity(after);
  const hasPondIdentity = typeof beforeIdentity?.mountId === 'string'
    && typeof afterIdentity?.mountId === 'string';
  const seedBefore = before?.profile?.pondSceneGenerationKey;
  const seedAfter = after?.profile?.pondSceneGenerationKey;
  const hasSceneSeed = typeof seedBefore === 'string' && seedBefore.length > 0
    && typeof seedAfter === 'string' && seedAfter.length > 0;
  const identity = zenMainProfile ? {
    status: !hasSceneSeed ? 'unavailable' : (seedBefore === seedAfter ? 'preserved' : 'changed'),
    sceneGenerationKeyBefore: seedBefore ?? null,
    sceneGenerationKeyAfter: seedAfter ?? null,
    controllerMountStatus: !hasPondIdentity ? 'unavailable' : (
      beforeIdentity.mountId === afterIdentity.mountId ? 'preserved' : 'changed'
    ),
    firstFrameStatus: !hasPondIdentity ? 'unavailable' : (
      JSON.stringify(beforeIdentity) === JSON.stringify(afterIdentity) ? 'preserved' : 'changed'
    ),
    before: beforeIdentity,
    after: afterIdentity,
    scope: 'declared_scene_seed_with_observed_controller_lifecycle',
  } : { status: 'not_applicable' };
  const counts = (metrics) => ({
    sceneSessionSyncCount: nullableNumber(metrics?.sceneSessionSyncCount),
    staticSceneSyncCount: nullableNumber(metrics?.staticSceneSyncCount),
    ambientPopulationSyncCount: nullableNumber(metrics?.ambientPopulationSyncCount),
    fishRosterSyncCount: nullableNumber(metrics?.fishRosterSyncCount),
    viewportReflowCount: nullableNumber(metrics?.viewportReflowCount),
  });
  return Object.freeze({
    schemaVersion: 1,
    pageTargetId,
    from,
    to,
    viewportApplied: matchesDashboardCaptureViewport(after, to),
    sameDocument: Number.isFinite(before?.performance?.timeOriginEpochMs)
      && before.performance.timeOriginEpochMs === after?.performance?.timeOriginEpochMs,
    pondIdentity: identity,
    beforeLayout: { stage: before?.stage, pond: before?.pond, bonsai: before?.bonsai },
    afterLayout: { stage: after?.stage, pond: after?.pond, bonsai: after?.bonsai },
    runtimeCounts: { before: counts(metricsBefore), after: counts(metricsAfter) },
    sceneLayout: {
      before: metricsBefore?.sceneLayout ?? null,
      after: metricsAfter?.sceneLayout ?? null,
    },
    runtimeMetricsStatus: {
      before: metricsBefore?.status ?? 'not_applicable',
      after: metricsAfter?.status ?? 'not_applicable',
    },
    pondViewport: zenMainProfile ? {
      current: isCurrentDashboardPondViewport(after, metricsAfter),
      viewport: metricsAfter?.viewport ?? null,
      sampleFrames: nullableNumber(metricsAfter?.sampleFrames),
    } : null,
    limitation: 'Scene seed is the capture profile declaration. Controller remounts may follow quality policy; this evidence does not prove GPU texture or renderer object identity, and sync counters are not allocation counts.',
  });
}
