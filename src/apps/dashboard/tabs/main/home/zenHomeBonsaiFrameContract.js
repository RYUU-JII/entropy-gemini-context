import {
  ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES,
  ZEN_BONSAI_PRESENTATION_MODES,
} from '@/themes/plugins/zen/model/ZenBonsaiPresentationPolicy.js';

export const ZEN_HOME_BONSAI_LIFECYCLE_INPUT_SOURCES = Object.freeze({
  FIRST_VISION: 'first_vision_explicit',
  AUTHORITATIVE: 'authoritative',
  NONE: 'none',
});

const normalizeRequiredToken = (value) => (
  typeof value === 'string' && value.trim() && value.trim() === value ? value : ''
);

const normalizeBonsaiMaterializationToken = (metadata = null) => {
  const sceneCommitKey = normalizeRequiredToken(metadata?.sceneCommitKey);
  const inputSignature = normalizeRequiredToken(metadata?.inputSignature);
  const bonsaiMaterializationKey = normalizeRequiredToken(metadata?.bonsaiMaterializationKey);
  if (!sceneCommitKey || !inputSignature || !bonsaiMaterializationKey) return null;
  return {
    sceneCommitKey,
    inputSignature,
    bonsaiMaterializationKey,
  };
};

const materializationTokensMatch = (left = null, right = null) => Boolean(
  left
  && right
  && left.sceneCommitKey === right.sceneCommitKey
  && left.inputSignature === right.inputSignature
  && left.bonsaiMaterializationKey === right.bonsaiMaterializationKey
);

export function resolveZenHomeBonsaiLifecycleFrameInput({
  firstVisionPresentation = false,
  presentationMode = null,
  cultivationLedgerPolicy = null,
  authoritativeInput = null,
} = {}) {
  if (firstVisionPresentation === true) {
    const resolvedPresentationMode = normalizeRequiredToken(presentationMode);
    const resolvedCultivationLedgerPolicy = normalizeRequiredToken(cultivationLedgerPolicy);
    if (!resolvedPresentationMode) {
      throw new Error('ZEN_HOME_FIRST_VISION_BONSAI_PRESENTATION_MODE_REQUIRED');
    }
    if (!resolvedCultivationLedgerPolicy) {
      throw new Error('ZEN_HOME_FIRST_VISION_BONSAI_LEDGER_POLICY_REQUIRED');
    }
    if (resolvedPresentationMode !== ZEN_BONSAI_PRESENTATION_MODES.FIRST_VISION) {
      throw new Error('ZEN_HOME_FIRST_VISION_BONSAI_PRESENTATION_MODE_INVALID');
    }
    if (
      resolvedCultivationLedgerPolicy
      !== ZEN_BONSAI_CULTIVATION_LEDGER_POLICIES.READ_ONLY
    ) {
      throw new Error('ZEN_HOME_FIRST_VISION_BONSAI_LEDGER_POLICY_INVALID');
    }
    return {
      input: {
        bonsaiPresentationMode: resolvedPresentationMode,
        bonsaiCultivationLedgerPolicy: resolvedCultivationLedgerPolicy,
      },
      source: ZEN_HOME_BONSAI_LIFECYCLE_INPUT_SOURCES.FIRST_VISION,
    };
  }

  if (authoritativeInput !== null && typeof authoritativeInput === 'object') {
    return {
      input: authoritativeInput,
      source: ZEN_HOME_BONSAI_LIFECYCLE_INPUT_SOURCES.AUTHORITATIVE,
    };
  }

  return {
    input: null,
    source: ZEN_HOME_BONSAI_LIFECYCLE_INPUT_SOURCES.NONE,
  };
}

export function resolveZenHomeBonsaiPreparedMaterialization(metadata = null, {
  expectedSceneCommitKey = null,
  expectedInputSignature = null,
} = {}) {
  const token = normalizeBonsaiMaterializationToken(metadata);
  const normalizedExpectedSceneCommitKey = normalizeRequiredToken(expectedSceneCommitKey);
  const normalizedExpectedInputSignature = normalizeRequiredToken(expectedInputSignature);

  if (!token) return null;
  if (
    !normalizedExpectedSceneCommitKey
    || token.sceneCommitKey !== normalizedExpectedSceneCommitKey
  ) {
    return null;
  }
  if (
    !normalizedExpectedInputSignature
    || token.inputSignature !== normalizedExpectedInputSignature
  ) {
    return null;
  }

  return token;
}

export function resolveZenHomeFirstViewportNotification({
  firstViewportReady = false,
  candidateToken = null,
  notifiedToken = null,
} = {}) {
  const candidate = normalizeBonsaiMaterializationToken(candidateToken);
  if (firstViewportReady !== true || !candidate) {
    return {
      shouldNotify: false,
      nextNotifiedToken: null,
    };
  }

  const notified = normalizeBonsaiMaterializationToken(notifiedToken);
  return {
    shouldNotify: !materializationTokensMatch(notified, candidate),
    nextNotifiedToken: candidate,
  };
}

export function isZenHomeBonsaiMaterializationAckCurrent(metadata = null, {
  preparedMaterialization = null,
  expectedSceneCommitKey = null,
  expectedInputSignature = null,
} = {}) {
  return resolveZenHomeBonsaiMaterializationAck(metadata, {
    preparedMaterialization,
    expectedSceneCommitKey,
    expectedInputSignature,
  }).accepted;
}

export function resolveZenHomeBonsaiMaterializationAck(metadata = null, {
  preparedMaterialization = null,
  expectedSceneCommitKey = null,
  expectedInputSignature = null,
} = {}) {
  const normalizedExpectedSceneCommitKey = normalizeRequiredToken(expectedSceneCommitKey);
  const normalizedExpectedInputSignature = normalizeRequiredToken(expectedInputSignature);
  if (!normalizedExpectedSceneCommitKey) {
    return Object.freeze({ accepted: false, reason: 'expected_scene_commit_key_missing' });
  }
  if (!normalizedExpectedInputSignature) {
    return Object.freeze({ accepted: false, reason: 'expected_input_signature_missing' });
  }
  const preparedToken = normalizeBonsaiMaterializationToken(preparedMaterialization);
  if (!preparedToken) {
    return Object.freeze({ accepted: false, reason: 'prepared_materialization_missing' });
  }
  if (preparedToken.sceneCommitKey !== normalizedExpectedSceneCommitKey) {
    return Object.freeze({ accepted: false, reason: 'prepared_scene_commit_key_mismatch' });
  }
  if (preparedToken.inputSignature !== normalizedExpectedInputSignature) {
    return Object.freeze({ accepted: false, reason: 'prepared_input_signature_mismatch' });
  }

  const sceneCommitKey = normalizeRequiredToken(metadata?.sceneCommitKey);
  if (!sceneCommitKey) {
    return Object.freeze({ accepted: false, reason: 'scene_commit_key_missing' });
  }
  if (sceneCommitKey !== preparedToken.sceneCommitKey) {
    return Object.freeze({ accepted: false, reason: 'scene_commit_key_mismatch' });
  }
  const inputSignature = normalizeRequiredToken(metadata?.inputSignature);
  if (!inputSignature) {
    return Object.freeze({ accepted: false, reason: 'input_signature_missing' });
  }
  if (inputSignature !== preparedToken.inputSignature) {
    return Object.freeze({ accepted: false, reason: 'input_signature_mismatch' });
  }
  const bonsaiMaterializationKey = normalizeRequiredToken(metadata?.bonsaiMaterializationKey);
  if (!bonsaiMaterializationKey) {
    return Object.freeze({ accepted: false, reason: 'bonsai_materialization_key_missing' });
  }
  if (bonsaiMaterializationKey !== preparedToken.bonsaiMaterializationKey) {
    return Object.freeze({ accepted: false, reason: 'bonsai_materialization_key_mismatch' });
  }
  return Object.freeze({ accepted: true, reason: 'bonsai_materialization_ack_current' });
}

export function resolveZenHomePendingBonsaiFrameAck(metadata = null, resolution = null, {
  expectedSceneCommitKey = null,
  expectedInputSignature = null,
} = {}) {
  if (
    resolution?.accepted !== false
    || resolution?.reason !== 'prepared_materialization_missing'
  ) {
    return null;
  }
  const token = normalizeBonsaiMaterializationToken(metadata);
  const normalizedExpectedSceneCommitKey = normalizeRequiredToken(expectedSceneCommitKey);
  const normalizedExpectedInputSignature = normalizeRequiredToken(expectedInputSignature);
  if (
    !token
    || !normalizedExpectedSceneCommitKey
    || !normalizedExpectedInputSignature
    || token.sceneCommitKey !== normalizedExpectedSceneCommitKey
    || token.inputSignature !== normalizedExpectedInputSignature
  ) {
    return null;
  }
  return metadata;
}

export function resolveZenHomeSceneAck(metadata = null, expectedSceneCommitKey = null) {
  const actualSceneCommitKey = normalizeRequiredToken(metadata?.sceneCommitKey);
  const resolvedExpectedSceneCommitKey = normalizeRequiredToken(expectedSceneCommitKey);
  if (!resolvedExpectedSceneCommitKey) {
    return Object.freeze({ accepted: false, reason: 'expected_scene_commit_key_missing' });
  }
  if (!actualSceneCommitKey) {
    return Object.freeze({ accepted: false, reason: 'scene_commit_key_missing' });
  }
  if (actualSceneCommitKey !== resolvedExpectedSceneCommitKey) {
    return Object.freeze({ accepted: false, reason: 'scene_commit_key_mismatch' });
  }
  return Object.freeze({ accepted: true, reason: 'scene_ack_current' });
}

export function isZenHomeSceneAckCurrent(metadata = null, expectedSceneCommitKey = null) {
  return resolveZenHomeSceneAck(metadata, expectedSceneCommitKey).accepted;
}
