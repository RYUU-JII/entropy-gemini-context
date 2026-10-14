import {
  PROGRESSION_UNLOCK_SOURCES,
  requireProgressionUnlockSnapshot,
} from '../../../../domains/progression/policy/progressionUnlockPolicy.js';
import {
  ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES,
  ZEN_BONSAI_PRESENTATION_MODES,
} from './ZenBonsaiPresentationPolicy.js';

export function projectZenBonsaiLifecycleInputForProgressionUnlock(
  canonicalInput,
  unlockProgress,
) {
  const snapshot = requireProgressionUnlockSnapshot(unlockProgress);
  const debugOverrideActive = snapshot.source === PROGRESSION_UNLOCK_SOURCES.DEBUG_OVERRIDE;
  if (!canonicalInput && !debugOverrideActive) return null;

  return Object.freeze({
    ...(canonicalInput || {}),
    bonsaiRelease: snapshot.bonsaiRelease,
    ...(debugOverrideActive ? {
      bonsaiEvidenceReady: true,
      bonsaiPresentationMode: ZEN_BONSAI_PRESENTATION_MODES.DEBUG_PROGRESSION_PREVIEW,
      bonsaiCultivationLedgerPolicy: ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.READ_ONLY,
    } : {}),
  });
}

export default projectZenBonsaiLifecycleInputForProgressionUnlock;
