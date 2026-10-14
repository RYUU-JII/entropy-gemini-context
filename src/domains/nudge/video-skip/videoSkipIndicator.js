export const INDICATOR_TICK_MS = 1000;

export function buildVideoIndicatorPayload({
  active,
  videosSize,
  activeVideo,
  pool: _pool,
  policy: _policy,
  indicatorAlertUntil,
  indicatorAlertReason,
  skipUiUntil,
  overrideVisible,
}) {
  const now = Date.now();
  const hasVideo = videosSize > 0;
  const isPlaying = !!(activeVideo && !activeVideo.paused && !activeVideo.ended);
  const alertActive = indicatorAlertUntil > now;
  const skipUiActive = skipUiUntil > now;
  const visible = typeof overrideVisible === 'boolean'
    ? overrideVisible
    : hasVideo && (skipUiActive || alertActive);

  return {
    enabled: !!active,
    hasVideo,
    visible,
    skipUiActive,
    isPlaying,
    mode: 'hard_block',
    cooldownRemainingMs: 0,
    hardBlock: true,
    rate: activeVideo ? Number(activeVideo.playbackRate) || 1 : 1,
    alert: alertActive,
    alertReason: alertActive ? indicatorAlertReason : null,
  };
}

export function shouldEmitVideoIndicatorUpdate({
  force = false,
  payload,
  lastSnapshot,
  lastIndicatorAt = 0,
}) {
  if (force) return true;
  const now = Date.now();
  const last = lastSnapshot;

  const criticalChange = !last
    || payload.enabled !== last.enabled
    || payload.visible !== last.visible
    || payload.hasVideo !== last.hasVideo
    || payload.isPlaying !== last.isPlaying
    || payload.mode !== last.mode
    || payload.alert !== last.alert
    || payload.rate !== last.rate;

  if (criticalChange) return true;
  const tickDue = now - lastIndicatorAt >= INDICATOR_TICK_MS;
  const shouldTick = tickDue && (payload.visible || payload.alert);
  return shouldTick;
}
