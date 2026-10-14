import {
  RUNTIME_ARTIFACT_IDS,
} from '../../contracts/artifactIds.js';
import {
  normalizeArtifactStateMap,
  normalizeDirectTriggers,
  normalizeObservation,
  normalizePressureSignals,
  normalizeProtectionProfile,
} from '../../contracts/protectionContracts.js';
import { getRuntimeArtifactDefinition } from '../../catalog/artifactCatalog.js';
import {
  isTimeWindowActive,
  normalizeTimeWindowTimestamp,
  resolveTimeWindowUntil,
} from '../../../../lib/timeWindow.js';

function hasMatchingTrigger(triggerList = [], signalSet = new Set()) {
  return triggerList.some((trigger) => signalSet.has(trigger));
}

export function updateArtifactCooldowns({
  artifacts = {},
  observation,
  cooldowns = {},
} = {}) {
  const normalizedObservation = normalizeObservation(observation);
  const nextCooldowns = Object.entries(cooldowns || {}).reduce((acc, [artifactId, until]) => {
    if (isTimeWindowActive(until, normalizedObservation.now)) {
      acc[artifactId] = normalizeTimeWindowTimestamp(until);
    }
    return acc;
  }, {});

  RUNTIME_ARTIFACT_IDS.forEach((artifactId) => {
    const state = artifacts?.[artifactId];
    if (state !== 'engaged' && state !== 'cleanup') return;

    const definition = getRuntimeArtifactDefinition(artifactId);
    if (!definition) return;

    nextCooldowns[artifactId] = resolveTimeWindowUntil(
      normalizedObservation.now,
      definition.cooldownMs,
    );
  });

  return nextCooldowns;
}

export function createArtifactPlanResolver() {
  function resolve({
    profile,
    observation,
    cooldowns = {},
  } = {}) {
    const normalizedProfile = normalizeProtectionProfile(profile);
    const normalizedObservation = normalizeObservation(observation);
    const directTriggerSet = new Set(normalizeDirectTriggers(normalizedObservation.directTriggers));
    const pressureSignalSet = new Set(normalizePressureSignals(normalizedObservation.pressureSignals));
    const activationSignalSet = new Set([
      ...directTriggerSet,
      ...pressureSignalSet,
    ]);
    const artifactStates = {};

    RUNTIME_ARTIFACT_IDS.forEach((artifactId) => {
      const definition = getRuntimeArtifactDefinition(artifactId);
      const preference = normalizedProfile.artifacts?.[artifactId];
      const cooldownUntil = Number(cooldowns?.[artifactId]) || 0;
      const onCooldown = isTimeWindowActive(cooldownUntil, normalizedObservation.now);

      if (!definition || !preference?.enabled) {
        artifactStates[artifactId] = 'disabled';
        return;
      }

      if (!preference.autoTrigger) {
        artifactStates[artifactId] = 'armed';
        return;
      }

      if (hasMatchingTrigger(definition.cleanupTriggers, activationSignalSet) && preference.autoTrigger) {
        artifactStates[artifactId] = onCooldown ? 'armed' : 'cleanup';
        return;
      }

      if (hasMatchingTrigger(definition.engageTriggers, activationSignalSet) && preference.autoTrigger) {
        artifactStates[artifactId] = onCooldown ? 'armed' : 'engaged';
        return;
      }

      const shouldArm = definition.armsWhenEnabled
        || hasMatchingTrigger(definition.armTriggers, activationSignalSet);

      artifactStates[artifactId] = shouldArm ? 'armed' : 'disabled';
    });

    return normalizeArtifactStateMap(artifactStates);
  }

  return {
    resolve,
  };
}
