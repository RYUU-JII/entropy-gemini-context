import {
  SENTINEL_ENTRY_SEAM_PROTOCOLS,
} from './nudgeEntrySeamGate.js';
import { normalizeSentinelFlareDeliveryForm } from './sentinelFlareDeliveryForm.js';

export const SENTINEL_PROTOCOL_ENTRY_MODES = Object.freeze({
  IMMEDIATE: 'immediate',
  INTEGRATED_RITUAL: 'integrated_ritual',
  ARMED_BOUNDARY: 'armed_boundary',
});

function isGlobalSentinelStart(config = {}) {
  return config?.protocolScope === SENTINEL_ENTRY_SEAM_PROTOCOLS.GLOBAL;
}

export function buildSiteFurinChimeConfig(config = {}) {
  return { ...config, deliveryForm: normalizeSentinelFlareDeliveryForm(config.deliveryForm) };
}

export function resolveGlobalNudgeEntrySeamOptions(config = {}) {
  if (!isGlobalSentinelStart(config)) {
    throw new Error(`nudge_entry_seam_global_scope_required:${config?.protocolScope || ''}`);
  }
  return {
    protocolScope: SENTINEL_ENTRY_SEAM_PROTOCOLS.GLOBAL,
    protocolIntensity: config?.protocolIntensity,
    presageConfig: config?.presage || null,
    presageCount: 1,
    presage: false,
    commitOnBoundary: true,
  };
}

export function resolveSentinelProtocolEntryPolicy({
  config = {},
  reason = 'auto',
} = {}) {
  const deliveryForm = normalizeSentinelFlareDeliveryForm(config.deliveryForm);
  if (isGlobalSentinelStart(config) && deliveryForm !== 'full') {
    throw new Error('sentinel_flare_global_brief_forbidden');
  }
  config = { ...config, deliveryForm };
  if (reason === 'debug' && isGlobalSentinelStart(config)) {
    return {
      mode: SENTINEL_PROTOCOL_ENTRY_MODES.IMMEDIATE,
      startConfig: config,
      diagnostic: null,
      seamOptions: null,
    };
  }
  if (isGlobalSentinelStart(config)) {
    return {
      mode: SENTINEL_PROTOCOL_ENTRY_MODES.ARMED_BOUNDARY,
      startConfig: config,
      seamOptions: resolveGlobalNudgeEntrySeamOptions(config),
      diagnostic: {
        phase: 'nudge_entry_seam_armed',
      },
    };
  }
  return {
    mode: reason === 'debug' ? SENTINEL_PROTOCOL_ENTRY_MODES.INTEGRATED_RITUAL : SENTINEL_PROTOCOL_ENTRY_MODES.ARMED_BOUNDARY,
    startConfig: buildSiteFurinChimeConfig(config),
    seamOptions: reason === 'debug' ? null : { protocolScope: SENTINEL_ENTRY_SEAM_PROTOCOLS.SITE, presage: false, commitOnBoundary: true, idleMs: 5_000, capMs: 5_000 },
    diagnostic: {
      phase: reason === 'debug' ? 'nudge_entry_seam_integrated_ritual' : 'nudge_entry_seam_armed',
      protocolScope: SENTINEL_ENTRY_SEAM_PROTOCOLS.SITE,
      ...(reason === 'debug' ? {
        committedBy: 'integrated_ritual',
        commitReason: 'site_furin_integrated_ritual',
        eventType: 'nudge_start',
        waitedMs: 0,
      } : {}),
    },
  };
}
