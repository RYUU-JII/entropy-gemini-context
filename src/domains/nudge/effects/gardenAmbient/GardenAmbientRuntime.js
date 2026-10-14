import {
  buildEmptyGardenAmbientSnapshot,
  buildGardenAmbientSurfaceState,
  normalizeGardenAmbientSnapshot,
  normalizeGardenAmbientSurface,
} from '../../garden/ambient/contracts/gardenAmbientContracts.js';
import {
  getGardenAmbientCeremonyDefinition,
  getGardenAmbientToneDefinition,
} from '../../garden/ambient/catalog/gardenAmbientCatalog.js';

function buildConsumptionKey(snapshot, surface) {
  return `${snapshot.cycleKey || 'none'}:${snapshot.ceremony.id || 'none'}:${surface}`;
}

export function createGardenAmbientRuntime({ initialSnapshot = null } = {}) {
  let snapshot = normalizeGardenAmbientSnapshot(initialSnapshot || buildEmptyGardenAmbientSnapshot());
  let consumedCeremonyKeys = new Set();

  function resetConsumedState() {
    consumedCeremonyKeys = new Set();
  }

  function getSnapshot() {
    return snapshot;
  }

  function setSnapshot(nextSnapshot) {
    const normalized = normalizeGardenAmbientSnapshot(nextSnapshot);
    const cycleChanged = normalized.cycleKey !== snapshot.cycleKey;
    const ceremonyChanged = normalized.ceremony.id !== snapshot.ceremony.id;
    snapshot = normalized;
    if (cycleChanged || ceremonyChanged) {
      resetConsumedState();
    }
    return snapshot;
  }

  function resolveSurfaceState(surface, { consume = false } = {}) {
    const normalizedSurface = normalizeGardenAmbientSurface(surface);
    const toneDefinition = getGardenAmbientToneDefinition(snapshot.tone);
    const ceremonyDefinition = getGardenAmbientCeremonyDefinition(snapshot.ceremony.id);
    const ceremonyAllowed = ceremonyDefinition.allowedSurfaces.includes(normalizedSurface);
    const ceremonyKey = buildConsumptionKey(snapshot, normalizedSurface);
    const ceremonyAvailable = snapshot.ceremony.eligible
      && snapshot.ceremony.id !== 'none'
      && ceremonyAllowed
      && !consumedCeremonyKeys.has(ceremonyKey);

    if (consume && ceremonyAvailable && ceremonyDefinition.singleRunPerCycle) {
      consumedCeremonyKeys.add(ceremonyKey);
    }

    return buildGardenAmbientSurfaceState({
      surface: normalizedSurface,
      cycleKey: snapshot.cycleKey,
      tone: snapshot.tone,
      ceremony: ceremonyAvailable ? snapshot.ceremony.id : 'none',
      tier: ceremonyAvailable ? ceremonyDefinition.tier : 'quiet',
      accents: {
        ...toneDefinition.defaultAccents,
        ...snapshot.accents,
      },
      reasonCodes: snapshot.reasonCodes,
      meta: {
        source: snapshot.meta.source,
        generatedAt: snapshot.meta.generatedAt,
        toneLabel: toneDefinition.label,
        ceremonyLabel: ceremonyDefinition.label,
        ceremonyDurationMs: ceremonyDefinition.maxDurationMs,
        ceremonyAvailable,
      },
    });
  }

  function peekSurfaceState(surface) {
    return resolveSurfaceState(surface, { consume: false });
  }

  function consumeSurfaceState(surface) {
    return resolveSurfaceState(surface, { consume: true });
  }

  function resetForTest() {
    snapshot = buildEmptyGardenAmbientSnapshot();
    resetConsumedState();
  }

  return {
    getSnapshot,
    setSnapshot,
    peekSurfaceState,
    consumeSurfaceState,
    resetForTest,
  };
}
