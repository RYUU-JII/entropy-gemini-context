import fs from 'node:fs/promises';
import path from 'node:path';

import {
  probeBrowserQaLoopbackTcpEndpoint,
} from '../../browser-qa/network/loopbackTcpProbe.mjs';
import {
  projectBrowserQaDedicatedProfileOwnership,
} from '../../browser-qa/lifecycle/persistentBrowserLifecycle.mjs';
import {
  verifyEntropyQaDedicatedProfileOwnership,
} from '../profile/entropyQaProfileMarker.mjs';

async function pathKind(targetPath) {
  if (!targetPath) return 'not_required';
  const stat = await fs.stat(targetPath).catch(() => null);
  if (!stat) return 'missing';
  if (stat.isDirectory()) return 'directory';
  if (stat.isFile()) return 'file';
  return 'unsupported';
}
async function probeCdp(endpoint, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 2_000,
  tcpProbe = fetchImpl === globalThis.fetch
    ? probeBrowserQaLoopbackTcpEndpoint
    : null,
  includeTargetCounts = false,
} = {}) {
  if (!endpoint) return Object.freeze({ status: 'not_required' });
  if (tcpProbe !== null && typeof tcpProbe !== 'function') {
    throw new Error('QA_CDP_TCP_PROBE_ADAPTER_INVALID');
  }
  if (tcpProbe) {
    const reachability = await tcpProbe(endpoint);
    if (!['reachable', 'unavailable'].includes(reachability?.status)) {
      throw new Error('QA_CDP_TCP_PROBE_RESULT_INVALID');
    }
    if (reachability.status === 'unavailable') {
      return Object.freeze({
        status: 'unavailable',
        error: `tcp_${reachability.errorCode || 'unavailable'}`,
      });
    }
  }
  try {
    const response = await fetchImpl(new URL('/json/version', endpoint), {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      return Object.freeze({ status: 'unavailable', httpStatus: response.status });
    }
    const version = await response.json();
    if (
      typeof version?.Browser !== 'string'
      || typeof version?.webSocketDebuggerUrl !== 'string'
    ) {
      return Object.freeze({ status: 'invalid_contract' });
    }
    let targetCounts = null;
    if (includeTargetCounts === true) {
      const targetsResponse = await fetchImpl(new URL('/json/list', endpoint), {
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!targetsResponse.ok) {
        return Object.freeze({
          status: 'unavailable',
          httpStatus: targetsResponse.status,
        });
      }
      const targets = await targetsResponse.json();
      if (!Array.isArray(targets)) {
        return Object.freeze({ status: 'invalid_contract' });
      }
      const pageTargets = targets.filter((target) => target?.type === 'page');
      targetCounts = Object.freeze({
        total: targets.length,
        page: pageTargets.length,
      });
    }
    return Object.freeze({
      status: 'ready',
      browser: version.Browser,
      protocolVersion: version['Protocol-Version'] || null,
      ...(targetCounts ? { targetCounts } : {}),
    });
  } catch (error) {
    return Object.freeze({
      status: 'unavailable',
      error: error?.message || String(error),
    });
  }
}

async function inspectDedicatedProfileOwnership(environment, verifier) {
  if (environment?.lifecyclePolicy !== 'managed') {
    return Object.freeze({ status: 'not_required' });
  }
  if (typeof verifier !== 'function') {
    return Object.freeze({
      status: 'unverified',
      reason: 'QA_DEDICATED_PROFILE_OWNERSHIP_VERIFIER_REQUIRED',
    });
  }
  try {
    const ownership = await verifier({
      profileSlot: environment.profileSlot,
      action: 'inspect',
    });
    return projectBrowserQaDedicatedProfileOwnership(
      environment.profileSlot,
      ownership,
    );
  } catch (error) {
    return Object.freeze({
      status: 'unverified',
      reason: error?.message || String(error),
    });
  }
}

export async function inspectQaEnvironment(environment, {
  cdpProbe = true,
  allowManagedExtensionSlotBootstrap = false,
  includeCdpTargetCounts = false,
  minimumPageTargetCount = 0,
  verifyDedicatedProfileOwnership = verifyEntropyQaDedicatedProfileOwnership,
  ...options
} = {}) {
  if (!environment) return Object.freeze({ status: 'not_required' });
  const [chrome, profile, extensionSlot, cdp, profileOwnership] = await Promise.all([
    pathKind(environment.chrome),
    pathKind(environment.profile),
    pathKind(environment.extensionSlot),
    cdpProbe
      ? probeCdp(environment.cdpEndpoint, {
        ...options,
        includeTargetCounts: includeCdpTargetCounts || minimumPageTargetCount > 0,
      })
      : Object.freeze({ status: 'skipped_broker_leased' }),
    inspectDedicatedProfileOwnership(
      environment,
      verifyDedicatedProfileOwnership,
    ),
  ]);
  const failures = [];
  if (environment.chrome && chrome !== 'file') failures.push('chrome_unavailable');
  if (environment.profile && profile !== 'directory') failures.push('profile_unavailable');
  if (profileOwnership.status === 'unverified') {
    failures.push('dedicated_profile_ownership_unverified');
  }
  const managedExtensionSlotPendingStage = allowManagedExtensionSlotBootstrap === true
    && environment.browserClass === 'managed_persistent'
    && environment.processOwnership === 'attach_only'
    && environment.lifecyclePolicy === 'managed'
    && extensionSlot === 'missing'
    && path.normalize(environment.extensionSlot)
      === path.normalize(`${environment.profile}.entropy-extension-slot`);
  if (
    environment.extensionSlot
    && extensionSlot !== 'directory'
    && !managedExtensionSlotPendingStage
  ) {
    failures.push('extension_slot_unavailable');
  }
  if (cdpProbe && environment.cdpEndpoint && cdp.status !== 'ready') {
    failures.push('cdp_unavailable');
  }
  if (
    cdp.status === 'ready'
    && minimumPageTargetCount > 0
    && cdp.targetCounts?.page < minimumPageTargetCount
  ) {
    failures.push('no_focus_baseline_page_missing');
  }
  return Object.freeze({
    status: failures.length === 0 ? 'ready' : 'blocked',
    environmentId: environment.id,
    browserClass: environment.browserClass,
    processOwnership: environment.processOwnership,
    lifecyclePolicy: environment.lifecyclePolicy,
    installationId: environment.installationId,
    profileSlotId: environment.profileSlotId,
    focusPolicy: environment.focusPolicy,
    audioPolicy: environment.audioPolicy,
    checks: Object.freeze({
      chrome,
      profile,
      extensionSlot: managedExtensionSlotPendingStage ? 'pending_stage' : extensionSlot,
      dedicatedProfileOwnership: profileOwnership,
      cdp,
    }),
    failures: Object.freeze(failures),
  });
}
