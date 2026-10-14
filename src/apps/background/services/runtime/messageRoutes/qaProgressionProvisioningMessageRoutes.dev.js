import { PROGRESSION_DEBUG_ACTIONS } from '@progression-debug-actions';
import {
  ARTIFACT_DISCLOSURE_FAMILY_ORDER,
  normalizeArtifactDisclosureActivityDayKey,
} from '../../../../../domains/progression/policy/artifactDisclosurePolicy.js';
import {
  PROGRESSION_FIRST_VISION_STATES,
} from '../../../../../domains/progression/contracts/progressionIds.js';
import { isTrustedExtensionPageSender } from '../../../../../platform/security/senderTrust.js';
import { PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT } from '../../../../../domains/progression/policy/progressionPreviewPolicy.js';
import { PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT, resolveProgressionJourneyFamilyIds } from '../../../../../domains/progression/policy/progressionJourneyPolicy.js';
import { requireQualifiedUseFacts } from '../../../../../domains/progression/contracts/qualifiedUseFacts.js';

const TARGET_QUALIFIED_USE_DAY_COUNT = PROGRESSION_DEBUG_PREVIEW_TARGET_DAY_COUNT;
const TRUSTED_QA_PAGE_SUFFIX = '/entropy-e2e.html';

function requireProfileGeneration(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) {
    throw new Error('PROGRESSION_QA_PROFILE_GENERATION_REQUIRED');
  }
  return value;
}

export function requireActivityDayKeys(value) {
  if (!Array.isArray(value) || value.length !== TARGET_QUALIFIED_USE_DAY_COUNT) {
    throw new Error('PROGRESSION_QA_ACTIVITY_DAY_KEYS_INVALID');
  }
  const keys = value.map((key) => normalizeArtifactDisclosureActivityDayKey(key));
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index] <= keys[index - 1]) {
      throw new Error('PROGRESSION_QA_ACTIVITY_DAY_KEYS_NON_MONOTONIC');
    }
  }
  return keys;
}

function requireTrustedQaSender(sender) {
  if (
    !isTrustedExtensionPageSender(sender)
    || typeof sender?.url !== 'string'
    || !sender.url.endsWith(TRUSTED_QA_PAGE_SUFFIX)
  ) {
    throw new Error('PROGRESSION_QA_UNTRUSTED_SENDER');
  }
}

export function requireCanonicalSnapshot(snapshot, {
  expectedDayCount,
  expectedFirstVisionState,
} = {}) {
  const unlock = snapshot?.unlockProgress;
  const facts = requireQualifiedUseFacts(unlock?.qualifiedUseFacts);
  const displayDayCount = Math.min(expectedDayCount, PROGRESSION_ARTIFACT_JOURNEY_TARGET_DAY_COUNT);
  const orderedFamilyIds = snapshot?.orderedFamilyIds;
  const expectedPrefix = resolveProgressionJourneyFamilyIds(expectedDayCount, {
    firstVisionSpent: expectedFirstVisionState === PROGRESSION_FIRST_VISION_STATES.SPENT,
  });
  if (
    unlock?.source !== 'canonical'
    || unlock?.debugOverrideActive !== false
    || facts.canonicalDayCount !== expectedDayCount
    || facts.effectiveDayCount !== expectedDayCount
    || unlock?.canonicalQualifiedUseDayCount !== displayDayCount
    || unlock?.qualifiedUseDayCount !== displayDayCount
    || snapshot?.qualifiedActivityDayCount !== expectedDayCount
    || !Array.isArray(orderedFamilyIds)
    || orderedFamilyIds.length !== ARTIFACT_DISCLOSURE_FAMILY_ORDER.length
    || orderedFamilyIds.some((familyId, index) => (
      familyId !== ARTIFACT_DISCLOSURE_FAMILY_ORDER[index]
    ))
    || !Array.isArray(snapshot?.disclosedFamilyIds)
    || snapshot.disclosedFamilyIds.length !== expectedPrefix.length
    || snapshot.disclosedFamilyIds.some((familyId, index) => familyId !== expectedPrefix[index])
  ) {
    throw new Error('PROGRESSION_QA_CANONICAL_SNAPSHOT_MISMATCH');
  }
  if (
    expectedDayCount === TARGET_QUALIFIED_USE_DAY_COUNT
    && snapshot.entriesByFamilyId?.veil?.runtimeEligible !== true
  ) {
    throw new Error('PROGRESSION_QA_VEIL_RUNTIME_ELIGIBILITY_REQUIRED');
  }
  return snapshot;
}

export async function provisionCanonicalProgression({
  progressionService,
  profileGeneration,
  activityDayKeys,
}) {
  requireProfileGeneration(profileGeneration);
  await progressionService.clearProgressionUnlockDebugOverride({ expectedProfileGeneration: profileGeneration });
  let firstVision = await progressionService.readFirstVisionSnapshot({
    expectedProfileGeneration: profileGeneration,
  });
  let snapshot = await progressionService.readArtifactDisclosureSnapshot({ expectedProfileGeneration: profileGeneration });
  const currentDayCount = snapshot.qualifiedActivityDayCount;
  if (
    !Number.isInteger(currentDayCount)
    || currentDayCount < 0
    || currentDayCount > TARGET_QUALIFIED_USE_DAY_COUNT
  ) {
    throw new Error(`PROGRESSION_QA_DAY_COUNT_OUT_OF_RANGE:${currentDayCount}`);
  }
  requireCanonicalSnapshot(snapshot, {
    expectedDayCount: currentDayCount,
    expectedFirstVisionState: firstVision.state,
  });
  if (
    currentDayCount > 0
    && snapshot.lastProcessedActivityDayKey !== activityDayKeys[currentDayCount - 1]
  ) {
    throw new Error('PROGRESSION_QA_ACTIVITY_DAY_CURSOR_MISMATCH');
  }
  const missingActivityDayKeys = activityDayKeys.slice(currentDayCount);

  if (firstVision.state === PROGRESSION_FIRST_VISION_STATES.PENDING) {
    firstVision = await progressionService.recordFirstVisionPresented({
      expectedProfileGeneration: profileGeneration,
    });
  }
  if (firstVision.state === PROGRESSION_FIRST_VISION_STATES.PRESENTED) {
    firstVision = await progressionService.recordFirstVisionSpent({
      expectedProfileGeneration: profileGeneration,
    });
  }
  if (firstVision.state !== PROGRESSION_FIRST_VISION_STATES.SPENT) {
    throw new Error(`PROGRESSION_QA_FIRST_VISION_STATE_INVALID:${firstVision.state}`);
  }

  for (const activityDayKey of missingActivityDayKeys) {
    snapshot = await progressionService.recordSuccessfulManagedProtectionActivityDay({
      activityDayKey,
      expectedProfileGeneration: profileGeneration,
    });
  }
  snapshot = await progressionService.readArtifactDisclosureSnapshot({ expectedProfileGeneration: profileGeneration });
  requireCanonicalSnapshot(snapshot, {
    expectedDayCount: TARGET_QUALIFIED_USE_DAY_COUNT,
    expectedFirstVisionState: firstVision.state,
  });
  const sessionCleanup = await progressionService.clearProgressionUnlockDebugSessionForQa({ expectedProfileGeneration: profileGeneration });
  return Object.freeze({
    profileGeneration,
    firstVision,
    snapshot,
    sessionCleanup,
    noOp: currentDayCount === TARGET_QUALIFIED_USE_DAY_COUNT,
    recordedActivityDayKeys: Object.freeze([...missingActivityDayKeys]),
  });
}

export function createQaProgressionProvisioningMessageRoutes({
  progressionService,
} = {}) {
  if (
    !progressionService
    || typeof progressionService.readArtifactDisclosureSnapshot !== 'function'
    || typeof progressionService.recordSuccessfulManagedProtectionActivityDay !== 'function'
  ) {
    throw new Error('PROGRESSION_QA_PROVISIONING_OWNER_REQUIRED');
  }
  if (
    typeof progressionService.clearProgressionUnlockDebugSessionForQa !== 'function'
  ) {
    throw new Error('PROGRESSION_QA_SESSION_OWNER_REQUIRED');
  }
  return {
    actions: {
      [PROGRESSION_DEBUG_ACTIONS.CLEAR_QA_SESSION_STATE]: (
        message,
        sender,
        sendResponse,
      ) => {
        try {
          requireTrustedQaSender(sender);
          const profileGeneration = requireProfileGeneration(message?.profileGeneration);
          void progressionService.clearProgressionUnlockDebugOverride({ expectedProfileGeneration: profileGeneration })
            .then((snapshot) => {
              if (
                snapshot?.unlockProgress?.source !== 'canonical'
                || snapshot?.unlockProgress?.debugOverrideActive !== false
              ) {
                throw new Error('PROGRESSION_QA_CANONICAL_SESSION_CLEANUP_MISMATCH');
              }
              return progressionService.clearProgressionUnlockDebugSessionForQa({ expectedProfileGeneration: profileGeneration })
                .then((sessionCleanup) => ({ snapshot, sessionCleanup }));
            })
            .then((result) => sendResponse?.({ success: true, result }))
            .catch((error) => {
              sendResponse?.({ success: false, error: error?.message || String(error) });
            });
          return true;
        } catch (error) {
          sendResponse?.({ success: false, error: error?.message || String(error) });
          return false;
        }
      },
      [PROGRESSION_DEBUG_ACTIONS.PROVISION_CANONICAL_QA_PROFILE]: (
        message,
        sender,
        sendResponse,
      ) => {
        try {
          requireTrustedQaSender(sender);
          const profileGeneration = requireProfileGeneration(message?.profileGeneration);
          const activityDayKeys = requireActivityDayKeys(message?.activityDayKeys);
          void provisionCanonicalProgression({
            progressionService,
            profileGeneration,
            activityDayKeys,
          }).then((result) => {
            sendResponse?.({ success: true, result });
          }).catch((error) => {
            sendResponse?.({ success: false, error: error?.message || String(error) });
          });
          return true;
        } catch (error) {
          sendResponse?.({ success: false, error: error?.message || String(error) });
          return false;
        }
      },
    },
  };
}

export default createQaProgressionProvisioningMessageRoutes;
