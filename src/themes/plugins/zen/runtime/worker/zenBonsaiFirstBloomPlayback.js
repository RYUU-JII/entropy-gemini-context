import {
    ZEN_BONSAI_FIRST_BLOOM_DURATION_MS,
    ZEN_BONSAI_FIRST_BLOOM_FULL_MASK,
    ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT,
    requireZenBonsaiFirstBloomMask,
} from '../../model/bonsai/plume/ZenBonsaiPlumeBloomPresentationContract.js';

export { ZEN_BONSAI_FIRST_BLOOM_DURATION_MS };

export function requireZenBonsaiFirstBloomPresentation(value) {
    if (value === null) return null;
    if (!value || typeof value.eventId !== 'string' || !value.eventId.trim()
        || !['pending', 'playing'].includes(value.phase)
        || typeof value.active !== 'boolean' || typeof value.reducedMotion !== 'boolean'
        || value.durationMs !== ZEN_BONSAI_FIRST_BLOOM_DURATION_MS) {
        throw new Error('ZEN_BONSAI_FIRST_BLOOM_PRESENTATION_INVALID');
    }
    requireZenBonsaiFirstBloomMask(value.activatedMask);
    if ((value.phase === 'pending') !== (value.activatedMask === 0)) {
        throw new Error('ZEN_BONSAI_FIRST_BLOOM_PHASE_MASK_MISMATCH');
    }
    return value;
}

// Five bounded active clocks share the existing worker loop. Control masks only
// add accepted touches; a later touch cannot reset another region's progress.
export function createZenBonsaiFirstBloomPlayback() {
    let event = null;
    let completedEventId = null;
    let completion = null;
    let workerActive = false;

    function clearSampleTimes() {
        if (event === null) return;
        event.lastSamples.fill(null);
        event.lastInvitationSample = null;
    }

    function finish(reason) {
        if (event === null || event.phase === 'complete') return;
        event.phase = 'complete';
        event.activatedMask = ZEN_BONSAI_FIRST_BLOOM_FULL_MASK;
        event.elapsedMs.fill(ZEN_BONSAI_FIRST_BLOOM_DURATION_MS);
        event.progress.fill(1);
        event.invitation.active = false;
        event.invitation.activatedMask = ZEN_BONSAI_FIRST_BLOOM_FULL_MASK;
        completedEventId = event.eventId;
        completion = { eventId: event.eventId, reason, completedMask: ZEN_BONSAI_FIRST_BLOOM_FULL_MASK };
        clearSampleTimes();
    }

    return {
        setPresentation(value, treeSeed) {
            const presentation = requireZenBonsaiFirstBloomPresentation(value);
            if (presentation === null) {
                event = null;
                completion = null;
                return;
            }
            if (event !== null && event.eventId === presentation.eventId && event.treeSeed !== treeSeed) {
                if (event.activatedMask !== 0) {
                    finish('tree_identity_changed');
                    return;
                }
                event.treeSeed = treeSeed;
            }
            if (event === null || event.eventId !== presentation.eventId) {
                const completed = completedEventId === presentation.eventId;
                event = {
                    ...presentation,
                    treeSeed,
                    phase: completed ? 'complete' : presentation.phase,
                    activatedMask: completed ? ZEN_BONSAI_FIRST_BLOOM_FULL_MASK : presentation.activatedMask,
                    elapsedMs: Array(ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT).fill(completed ? ZEN_BONSAI_FIRST_BLOOM_DURATION_MS : 0),
                    progress: Array(ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT).fill(completed ? 1 : 0),
                    lastSamples: Array(ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT).fill(null),
                    lastInvitationSample: null,
                    invitation: { active: !completed && presentation.active && workerActive,
                        activatedMask: completed ? ZEN_BONSAI_FIRST_BLOOM_FULL_MASK : presentation.activatedMask, elapsedMs: 0 },
                };
                return;
            }
            if (event.phase === 'complete' || (event.phase === 'playing' && presentation.phase === 'pending')) return;
            if (event.active !== presentation.active || event.reducedMotion !== presentation.reducedMotion) clearSampleTimes();
            event.active = presentation.active;
            event.reducedMotion = presentation.reducedMotion;
            // A stale partial mask is never allowed to rewind accepted touches.
            event.activatedMask |= presentation.activatedMask;
            event.invitation.activatedMask = event.activatedMask;
            if (event.activatedMask !== 0) event.phase = 'playing';
        },
        setWorkerActive(value) {
            if (workerActive !== value) clearSampleTimes();
            workerActive = value === true;
        },
        sample(nowMs) {
            if (event === null) return null;
            if (event.phase === 'complete') return event.progress;
            if (!Number.isFinite(nowMs)) throw new Error('ZEN_BONSAI_FIRST_BLOOM_CLOCK_INVALID');
            const admitted = workerActive && event.active;
            event.invitation.active = admitted;
            if (admitted) {
                if (event.lastInvitationSample !== null) {
                    event.invitation.elapsedMs = Math.min(4000, event.invitation.elapsedMs + Math.max(0, nowMs - event.lastInvitationSample));
                }
                event.lastInvitationSample = nowMs;
            } else {
                clearSampleTimes();
            }
            let finishedMask = 0;
            for (let index = 0; index < ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT; index += 1) {
                const bit = 1 << index;
                if ((event.activatedMask & bit) === 0) continue;
                if (admitted && event.reducedMotion) {
                    event.elapsedMs[index] = ZEN_BONSAI_FIRST_BLOOM_DURATION_MS;
                } else if (admitted) {
                    if (event.lastSamples[index] !== null) event.elapsedMs[index] += Math.max(0, nowMs - event.lastSamples[index]);
                    event.lastSamples[index] = nowMs;
                }
                event.progress[index] = Math.min(1, event.elapsedMs[index] / ZEN_BONSAI_FIRST_BLOOM_DURATION_MS);
                if (event.progress[index] === 1) finishedMask |= bit;
            }
            if (finishedMask === ZEN_BONSAI_FIRST_BLOOM_FULL_MASK) finish('finished');
            return event.progress;
        },
        getInvitation() {
            return event === null ? null : event.invitation;
        },
        takeCompletion() {
            const result = completion;
            completion = null;
            return result;
        },
    };
}
