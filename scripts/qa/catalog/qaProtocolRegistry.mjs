const PROTOCOL_LOADERS = Object.freeze({
  favicon_cache: () => import('../protocols/faviconQaProtocol.mjs'),
  echo_artifacts: () => import('../protocols/echoArtifactsQaProtocol.mjs'),
  tab_management: () => import('../protocols/tabManagementQaProtocol.mjs'),
  audio_dulling: () => import('../protocols/audioDullingQaProtocol.mjs'),
  command: () => import('../protocols/commandQaProtocol.mjs'),
  feed_horizon: () => import('../protocols/feedHorizonQaProtocol.mjs'),
  feed_consumption_research: () => import('../protocols/feedConsumptionResearchQaProtocol.mjs'),
  gate_runtime: () => import('../protocols/gateRuntimeQaProtocol.mjs'),
  gate_detour_runtime: () => import('../protocols/gateDetourRuntimeQaProtocol.mjs'),
  consumption_entry: () => import('../protocols/consumptionEntryQaProtocol.mjs'),
  protected_sites_journey: () => import('../protocols/protectedSitesJourneyQaProtocol.mjs'),
  goal_ends_real_site: () => import('../protocols/goalEndsRealSiteQaProtocol.mjs'),
  goal_ends_functional: () => import('../protocols/goalEndsFunctionalQaProtocol.mjs'),
  runtime_stability: () => import('../protocols/runtimeStabilityQaProtocol.mjs'),
  extension_reload: () => import('../protocols/extensionReloadQaProtocol.mjs'),
  profile_reset_maintenance: () => import('../protocols/profileResetMaintenanceQaProtocol.mjs'),
  settings_concurrency: () => import('../protocols/settingsConcurrencyQaProtocol.mjs'),
  settings_propagation: () => import('../protocols/settingsPropagationQaProtocol.mjs'),
  settings_permissions: () => import('../protocols/settingsPermissionsQaProtocol.mjs'),
  intervention_collision: () => import('../protocols/interventionCollisionQaProtocol.mjs'),
  media_frame_hold: () => import('../protocols/mediaFrameHoldQaProtocol.mjs'),
  native_video_skip: () => import('../protocols/nativeVideoSkipQaProtocol.mjs'),
  integrated_protection: () => import('../protocols/integratedProtectionQaProtocol.mjs'),
  human_setup: () => import('../protocols/humanSetupQaProtocol.mjs'),
  sentinel_runtime: () => import('../protocols/sentinelProtocolQaProtocol.mjs'),
  social_selector_drift_corpus: () => (
    import('../protocols/socialSelectorDriftCorpusQaProtocol.mjs')
  ),
  site_runtime: () => import('../protocols/siteRuntimeQaProtocol.mjs'),
  site_runtime_attached: () => import('../protocols/siteRuntimeAttachedQaProtocol.mjs'),
  video_skip_control_surface: () => (
    import('../protocols/videoSkipControlSurfaceQaProtocol.mjs')
  ),
  visual_capture: () => import('../protocols/visualCaptureQaProtocol.mjs'),
  zen_cherry_plume_live: () => import('../protocols/zenCherryPlumeLiveQaProtocol.mjs'),
  zen_rain_streaks: () => import('../protocols/zenRainStreaksQaProtocol.mjs'),
  dashboard_capture: () => import('../protocols/dashboardCaptureQaProtocol.mjs'),
  dashboard_sites_stored_reading: () => import('../protocols/dashboardSitesStoredReadingQaProtocol.mjs'),
  youtube_selector_drift_corpus: () => (
    import('../protocols/youtubeSelectorDriftCorpusQaProtocol.mjs')
  ),
});

export async function loadQaProtocol(protocolId) {
  const loader = PROTOCOL_LOADERS[protocolId];
  if (!loader) throw new Error(`QA_PROTOCOL_UNKNOWN:${protocolId || 'missing'}`);
  const protocolModule = await loader();
  if (typeof protocolModule?.executeQaProtocol !== 'function') {
    throw new Error(`QA_PROTOCOL_EXECUTE_REQUIRED:${protocolId}`);
  }
  return Object.freeze({
    id: protocolId,
    execute: protocolModule.executeQaProtocol,
  });
}

export function listQaProtocolIds() {
  return Object.keys(PROTOCOL_LOADERS);
}
