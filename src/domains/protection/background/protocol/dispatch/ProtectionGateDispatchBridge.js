import {
  DEFAULT_THEME_ID,
  assertCanonicalThemeId,
} from '../../../../../themes/core/ids.js';
import { resolveGatekeeperTheme } from '../../../../../themes/core/friction/runtime.js';
import { toErrorMessage } from './ProtectionDispatchTransport.js';

const GATE_DOCUMENT_DISPOSITIONS = Object.freeze([
  'preserved',
  'redirected',
]);
function requireGateDispatchOwnerMethod(owner, methodName, errorCode) {
  if (!owner || typeof owner[methodName] !== 'function') {
    throw new Error(errorCode);
  }
  return owner[methodName].bind(owner);
}

function requireGateRuntimeSnapshot(runtimeSnapshot) {
  if (runtimeSnapshot === null || typeof runtimeSnapshot !== 'object' || Array.isArray(runtimeSnapshot)) {
    throw new Error('PROTECTION_GATE_DISPATCH_RUNTIME_SNAPSHOT_REQUIRED');
  }
  return runtimeSnapshot;
}

function requireGateHostname(hostname) {
  const resolvedHostname = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
  if (!resolvedHostname) {
    throw new Error('PROTECTION_GATE_DISPATCH_HOSTNAME_REQUIRED');
  }
  return resolvedHostname;
}

function requireGateMutationFence(mutationFence) {
  if (
    !mutationFence
    || typeof mutationFence !== 'object'
    || Array.isArray(mutationFence)
    || typeof mutationFence.assertCurrent !== 'function'
  ) {
    throw new Error('PROTECTION_GATE_DISPATCH_MUTATION_FENCE_REQUIRED');
  }
  return mutationFence;
}

function assertGateMutationFenceCurrent(mutationFence, phase) {
  const result = mutationFence.assertCurrent(phase);
  if (result && typeof result.then === 'function') {
    throw new Error('PROTECTION_GATE_DISPATCH_MUTATION_FENCE_MUST_BE_SYNCHRONOUS');
  }
}

function requireGatePresentation(gatePresentation) {
  if (
    !gatePresentation
    || typeof gatePresentation !== 'object'
    || Array.isArray(gatePresentation)
  ) {
    throw new Error('PROTECTION_GATE_DISPATCH_PRESENTATION_RESULT_REQUIRED');
  }
  if (!GATE_DOCUMENT_DISPOSITIONS.includes(gatePresentation.documentDisposition)) {
    throw new Error('PROTECTION_GATE_DISPATCH_DOCUMENT_DISPOSITION_INVALID');
  }
  if (typeof gatePresentation.handled !== 'boolean') {
    throw new Error('PROTECTION_GATE_DISPATCH_PRESENTATION_HANDLED_REQUIRED');
  }
  if (gatePresentation.message != null || gatePresentation.presentationTransaction != null) {
    throw new Error('PROTECTION_GATE_DISPATCH_INLINE_PRESENTATION_RETIRED');
  }
  if (gatePresentation.documentDisposition === 'redirected' && !gatePresentation.handled) {
    throw new Error('PROTECTION_GATE_DISPATCH_REDIRECT_CONTRACT_INVALID');
  }
  return gatePresentation;
}

export function createProtectionGateDispatchBridge({
  gateInterstitialController,
  frictionBootstrapCoordinator,
  readThemePreference,
  recordDiagnostic,
  defaultThemeId = DEFAULT_THEME_ID,
} = {}) {
  const presentGateInterstitial = requireGateDispatchOwnerMethod(
    gateInterstitialController,
    'presentForRuntimeSnapshot',
    'PROTECTION_GATE_DISPATCH_INTERSTITIAL_OWNER_REQUIRED',
  );
  const refreshFrictionBootstrap = requireGateDispatchOwnerMethod(
    frictionBootstrapCoordinator,
    'refreshForRuntime',
    'PROTECTION_GATE_DISPATCH_BOOTSTRAP_OWNER_REQUIRED',
  );
  if (typeof readThemePreference !== 'function') {
    throw new Error('PROTECTION_GATE_DISPATCH_THEME_READER_REQUIRED');
  }
  if (typeof recordDiagnostic !== 'function') {
    throw new Error('PROTECTION_GATE_DISPATCH_DIAGNOSTICS_REQUIRED');
  }

  async function resolveThemePresentation() {
    const themeId = assertCanonicalThemeId(
      await readThemePreference(defaultThemeId),
      'protection gate stored theme preference',
    );
    return {
      themeId,
      gatekeeperTheme: await resolveGatekeeperTheme(themeId),
    };
  }

  async function present({
    tabId,
    url,
    runtimeSnapshot,
    now = Date.now(),
    mutationFence,
  } = {}) {
    const resolvedRuntimeSnapshot = requireGateRuntimeSnapshot(runtimeSnapshot);
    const resolvedMutationFence = requireGateMutationFence(mutationFence);
    assertGateMutationFenceCurrent(
      resolvedMutationFence,
      'gate_bridge_before_theme_resolution',
    );
    const themePresentation = await resolveThemePresentation();
    assertGateMutationFenceCurrent(
      resolvedMutationFence,
      'gate_bridge_after_theme_resolution',
    );
    const gatePresentation = requireGatePresentation(await presentGateInterstitial({
      tabId,
      url,
      runtimeSnapshot: resolvedRuntimeSnapshot,
      themePresentation,
      now,
      mutationFence: resolvedMutationFence,
    }));
    return {
      gatePresentation,
      themePresentation,
    };
  }

  async function refreshBootstrap({
    hostname,
    runtimeSnapshot,
    now = Date.now(),
    themePresentation = null,
  } = {}) {
    const resolvedHostname = requireGateHostname(hostname);
    const resolvedRuntimeSnapshot = requireGateRuntimeSnapshot(runtimeSnapshot);
    try {
      const refreshArgs = {
        hostname: resolvedHostname,
        runtimeSnapshot: resolvedRuntimeSnapshot,
        now,
      };
      if (themePresentation) {
        refreshArgs.themePresentation = themePresentation;
      }
      await refreshFrictionBootstrap(refreshArgs);
      return { ok: true };
    } catch (error) {
      recordDiagnostic('friction_bootstrap_refresh_failed', {
        hostname: resolvedHostname,
        error: toErrorMessage(error),
        hasRuntimeSnapshot: true,
      });
      return {
        ok: false,
        error: toErrorMessage(error),
      };
    }
  }

  // Tick-driven renewal requires a durable cache-write receipt. Its caller must
  // retry a rejected refresh instead of acknowledging a diagnostic-only result.
  async function refreshBootstrapStrict({
    hostname, runtimeSnapshot, now = Date.now(), themePresentation = null, assertCurrent,
  } = {}) {
    const resolvedHostname = requireGateHostname(hostname);
    const resolvedRuntimeSnapshot = requireGateRuntimeSnapshot(runtimeSnapshot);
    if (typeof assertCurrent !== 'function') throw new Error('PROTECTION_GATE_DISPATCH_BOOTSTRAP_FENCE_REQUIRED');
    assertGateMutationFenceCurrent({ assertCurrent }, 'gate_bootstrap_before_refresh');
    return refreshFrictionBootstrap({ hostname: resolvedHostname, runtimeSnapshot: resolvedRuntimeSnapshot,
      now, themePresentation, assertCurrent });
  }

  return {
    present,
    refreshBootstrap,
    refreshBootstrapStrict,
    resolveThemePresentation,
  };
}
