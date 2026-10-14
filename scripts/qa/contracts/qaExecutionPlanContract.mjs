import path from 'node:path';
import { resolveQaBrowserObservation } from './qaBrowserObservationContract.mjs';

import {
  QA_MODES,
  normalizeQaTargetParameters,
} from './qaTargetContract.mjs';
import {
  normalizeLegacyBrowserPresentationInput,
  resolveQaBrowserExecutionPlan,
} from './qaBrowserRequirementContract.mjs';

const RUN_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,159})$/u;

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function normalizeMode(mode, target) {
  const normalized = typeof mode === 'string' ? mode.trim() : '';
  if (!Object.values(QA_MODES).includes(normalized)) {
    fail('QA_RUN_MODE_INVALID', normalized || 'missing');
  }
  if (!target.supportedModes.includes(normalized)) {
    fail('QA_RUN_MODE_UNSUPPORTED', `${target.id}:${normalized}`);
  }
  return normalized;
}

export function compileQaExecutionPlan({
  rootDir,
  runId,
  target,
  mode,
  rawParameters = {},
  environment = null,
  artifactPaths = null,
  configPath,
} = {}) {
  if (!path.isAbsolute(rootDir || '')) fail('QA_PLAN_ROOT_ABSOLUTE_REQUIRED');
  if (typeof runId !== 'string' || !runId.trim()) fail('QA_PLAN_RUN_ID_REQUIRED');
  if (runId !== runId.trim() || !RUN_ID_PATTERN.test(runId)) {
    fail('QA_PLAN_RUN_ID_INVALID', runId);
  }
  if (!target?.id) fail('QA_PLAN_TARGET_REQUIRED');
  const normalizedMode = normalizeMode(mode, target);
  const compatibleParameters = normalizeLegacyBrowserPresentationInput(
    target,
    rawParameters,
  );
  const parameters = normalizeQaTargetParameters(target, compatibleParameters);
  const browserObservation = resolveQaBrowserObservation(target.browserObservation, parameters);
  if (browserObservation !== null && (
    environment?.lifecyclePolicy !== 'managed'
    || (browserObservation === 'document'
      ? !['background', 'foreground'].includes(parameters.presentation)
      : parameters.presentation !== 'foreground')
  )) fail('QA_FOREGROUND_OBSERVATION_MANAGED_PRESENTATION_REQUIRED', target.id);
  const environmentSnapshot = environment
    ? Object.freeze({ ...environment })
    : null;
  const artifactPathsSnapshot = artifactPaths
    ? Object.freeze({ ...artifactPaths })
    : null;
  const captureConcurrency = target.protocolId === 'visual_capture' ? 'shared_capture' : 'exclusive';
  const isolatedFunctionalTarget = target.concurrency === 'isolated_functional';
  if (isolatedFunctionalTarget && (
    captureConcurrency !== 'exclusive' || target.artifactId !== 'dev_extension'
    || parameters.rebuildDuringRun === true
    || environmentSnapshot?.processOwnership !== 'owned'
    || environmentSnapshot.lifecyclePolicy !== 'per_run'
    || environmentSnapshot.profile || environmentSnapshot.profileDirectory
    || environmentSnapshot.cdpEndpoint || environmentSnapshot.profileSlotId
    || environmentSnapshot.extensionSlot
    || target.browserRequirements?.osFocus !== 'never'
    || target.browserRequirements?.rendering === 'physical_gpu_required'
    || target.resourceClaims.some((claim) => claim.startsWith('artifact:')
      && claim !== 'artifact:dev_extension')
  )) fail('QA_ISOLATED_FUNCTIONAL_ENVIRONMENT_INVALID', target.id);
  if (captureConcurrency === 'shared_capture' && (
    target.artifactId !== 'source_render' || environmentSnapshot?.id !== 'visual'
    || environmentSnapshot.browserClass !== 'deterministic_visual'
    || environmentSnapshot.processOwnership !== 'owned'
    || environmentSnapshot.lifecyclePolicy !== 'per_run'
  )) fail('QA_VISUAL_CAPTURE_CONCURRENCY_ENVIRONMENT_INVALID', target.id);
  const browserExecution = resolveQaBrowserExecutionPlan({
    targetId: target.id,
    requirements: target.browserRequirements,
    environment: environmentSnapshot,
    parameters,
  });
  // Native windows/input retain exclusive capacity even for an otherwise
  // independent functional target. Only headless execution shares slots.
  const isolatedFunctional = isolatedFunctionalTarget && browserExecution?.headless === true;
  const browserConcurrency = isolatedFunctional ? 'isolated_functional'
    : captureConcurrency === 'shared_capture' ? 'shared_capture' : 'exclusive_measurement';
  const browserCapacityMode = browserConcurrency === 'exclusive_measurement'
    ? 'exclusive' : browserConcurrency;
  const resourceClaims = Object.freeze([
    ...new Set([
      ...target.resourceClaims,
      ...(target.artifactId ? [`artifact:${target.artifactId}`] : []),
    ].map((claim) => isolatedFunctional && claim.startsWith('runtime:')
      ? `${claim}:${runId}` : captureConcurrency === 'shared_capture'
      && ['artifact:source_render', 'runtime:visual-capture'].includes(claim)
      ? `${claim}:${runId}` : claim)),
  ].sort());
  // A copied development publication is private to this run. Only protocols
  // that rebuild during execution, or own child artifact lanes, need the
  // shared artifact claim beyond admission.
  const artifactAdmissionClaims = Object.freeze(
    target.artifactId === 'dev_extension' && parameters.rebuildDuringRun !== true
      ? ['artifact:dev_extension']
      : [],
  );
  return Object.freeze({
    contractVersion: 2,
    runId,
    targetId: target.id,
    target,
    mode: normalizedMode,
    lane: target.lane,
    protocolId: target.protocolId,
    environment: environmentSnapshot,
    browserRequirements: target.browserRequirements,
    browserObservation,
    browserExecution,
    captureConcurrency,
    browserConcurrency,
    browserCapacityMode,
    artifactId: target.artifactId,
    artifactPaths: artifactPathsSnapshot,
    resourceClaims,
    artifactAdmissionClaims,
    parameters,
    operatorHandoffPolicy: target.operatorHandoffPolicy,
    protocolOptions: target.protocolOptions,
    configPath,
    rootDir,
    runRoot: path.join(rootDir, '.artifacts', 'qa', 'runs', runId),
  });
}
