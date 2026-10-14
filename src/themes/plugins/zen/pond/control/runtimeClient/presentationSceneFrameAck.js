import {
    buildZenPondPresentationSceneCommitDescriptor,
    normalizeZenPondPresentationSceneCommitKey,
} from '../../contracts/zenPondPresentationSceneCommit.js';

const toNonNegativeInteger = (value) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
};

const toNonNegativeNumber = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const readRequiredText = (value) => (
    typeof value === 'string' && value.trim() ? value.trim() : null
);

export const buildZenPondExpectedPresentationSceneCommit = (snapshot = null) => {
    const key = normalizeZenPondPresentationSceneCommitKey(
        snapshot?.presentationSceneCommitKey,
    );
    if (key === null) return null;
    return buildZenPondPresentationSceneCommitDescriptor({
        presentationSceneCommitKey: key,
        presentationRosterSignature: snapshot?.presentationRosterSignature,
        workerRosterSignature: snapshot?.workerRosterSignature,
        expectedFishCount: snapshot?.expectedFishCount,
        deferredInvitationCount: snapshot?.deferredInvitationCount,
        requiredVisibleFishCount: snapshot?.requiredVisibleFishCount,
    });
};

export const resolveZenPondPresentationSceneFrameAck = ({
    expected = null,
    message = null,
} = {}) => {
    if (!expected) {
        return Object.freeze({ accepted: false, reason: 'no_pending_scene_commit' });
    }
    const messageKey = readRequiredText(message?.presentationSceneCommitKey);
    if (messageKey !== expected.presentationSceneCommitKey) {
        return Object.freeze({ accepted: false, reason: 'stale_scene_commit_key' });
    }
    const workerRosterSignature = readRequiredText(message?.workerRosterSignature);
    if (workerRosterSignature !== expected.workerRosterSignature) {
        return Object.freeze({ accepted: false, reason: 'stale_worker_roster_signature' });
    }
    const presentationRosterSignature = readRequiredText(message?.presentationRosterSignature);
    if (presentationRosterSignature !== expected.presentationRosterSignature) {
        return Object.freeze({ accepted: false, reason: 'stale_presentation_roster_signature' });
    }

    const fishCount = toNonNegativeInteger(message?.fishCount);
    const pendingInvitationCount = toNonNegativeInteger(message?.pendingInvitationCount);
    if (pendingInvitationCount === null || pendingInvitationCount > expected.deferredInvitationCount
        || fishCount === null || fishCount + pendingInvitationCount !== expected.expectedFishCount) {
        return Object.freeze({ accepted: false, reason: 'fish_count_mismatch' });
    }
    const requiredVisibleFishCount = toNonNegativeInteger(
        message?.requiredVisibleFishCount,
    );
    if (requiredVisibleFishCount !== expected.requiredVisibleFishCount) {
        return Object.freeze({ accepted: false, reason: 'required_visible_count_mismatch' });
    }
    const visibleFishCount = toNonNegativeInteger(message?.visibleFishCount);
    if (
        visibleFishCount === null
        || visibleFishCount < expected.requiredVisibleFishCount
    ) {
        return Object.freeze({ accepted: false, reason: 'visible_fish_count_insufficient' });
    }

    const appliedAfterFrameCount = toNonNegativeInteger(message?.appliedAfterFrameCount);
    const frameCount = toNonNegativeInteger(message?.frameCount);
    if (
        appliedAfterFrameCount === null
        || frameCount === null
        || frameCount <= appliedAfterFrameCount
    ) {
        return Object.freeze({ accepted: false, reason: 'non_subsequent_frame_count' });
    }
    const appliedAfterFrameAtMs = toNonNegativeNumber(message?.appliedAfterFrameAtMs);
    const frameAtMs = toNonNegativeNumber(message?.frameAtMs);
    if (
        appliedAfterFrameAtMs === null
        || frameAtMs === null
        || frameAtMs <= appliedAfterFrameAtMs
    ) {
        return Object.freeze({ accepted: false, reason: 'non_subsequent_frame_time' });
    }

    return Object.freeze({
        accepted: true,
        reason: 'presentation_scene_frame_committed',
        metadata: Object.freeze({
            ackKind: 'presentation_scene_frame_commit',
            sceneCommitKey: expected.presentationSceneCommitKey,
            presentationRosterSignature,
            workerRosterSignature,
            fishCount,
            pendingInvitationCount,
            visibleFishCount,
            requiredVisibleFishCount,
            appliedAfterFrameCount,
            frameCount,
            appliedAfterFrameAtMs,
            frameAtMs,
            source: typeof message?.source === 'string' ? message.source : '',
        }),
    });
};

export const resolveZenPondRetainedPresentationSceneAckReplay = ({
    expected = null,
    committedMetadata = null,
} = {}) => {
    if (!expected) {
        return Object.freeze({ accepted: false, reason: 'no_expected_scene_commit' });
    }
    if (!committedMetadata || typeof committedMetadata !== 'object') {
        return Object.freeze({ accepted: false, reason: 'no_committed_scene_ack' });
    }
    if (readRequiredText(committedMetadata.sceneCommitKey) !== expected.presentationSceneCommitKey) {
        return Object.freeze({ accepted: false, reason: 'retained_scene_commit_key_mismatch' });
    }
    if (
        readRequiredText(committedMetadata.workerRosterSignature)
        !== expected.workerRosterSignature
    ) {
        return Object.freeze({ accepted: false, reason: 'retained_worker_roster_signature_mismatch' });
    }
    if (
        readRequiredText(committedMetadata.presentationRosterSignature)
        !== expected.presentationRosterSignature
    ) {
        return Object.freeze({ accepted: false, reason: 'retained_presentation_roster_signature_mismatch' });
    }
    const fishCount = toNonNegativeInteger(committedMetadata.fishCount);
    const pendingInvitationCount = toNonNegativeInteger(committedMetadata.pendingInvitationCount);
    if (fishCount === null || pendingInvitationCount === null || pendingInvitationCount > expected.deferredInvitationCount
        || fishCount + pendingInvitationCount !== expected.expectedFishCount) {
        return Object.freeze({ accepted: false, reason: 'retained_fish_count_mismatch' });
    }
    if (
        toNonNegativeInteger(committedMetadata.requiredVisibleFishCount)
        !== expected.requiredVisibleFishCount
    ) {
        return Object.freeze({ accepted: false, reason: 'retained_required_visible_count_mismatch' });
    }
    const visibleFishCount = toNonNegativeInteger(committedMetadata.visibleFishCount);
    if (visibleFishCount === null || visibleFishCount < expected.requiredVisibleFishCount) {
        return Object.freeze({ accepted: false, reason: 'retained_visible_fish_count_insufficient' });
    }
    return Object.freeze({
        accepted: true,
        reason: 'retained_scene_ack_exact_match',
        metadata: committedMetadata,
    });
};
