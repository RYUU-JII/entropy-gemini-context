import { recordZenPondRuntimeHealthEvent } from './zenPondWorkerRuntimeHealth.js';

export const createZenPondWorkerControlSyncHandlers = ({
    MESSAGE_TYPE,
    runtimeState,
    RUNTIME_MODULES,
    applySceneSession,
    applyEnvironmentAuthority,
    applyRuntimeParams,
    applyFishRoster,
    buildControlAck,
    respondResult,
} = {}) => {
    const handleSyncSceneSession = async (id, payload) => {
        const modules = RUNTIME_MODULES;
        const result = applySceneSession(modules, runtimeState, payload?.sceneSession);
        respondResult(id, {
            synced: result?.changed === true,
            remounted: result?.remounted === true,
            sceneGenerationKey: result?.sceneGenerationKey || runtimeState.sceneGenerationKey,
            seed: Number(result?.seed) || Number(runtimeState.refs?.sessionSaltRef?.current) || 0,
            ack: buildControlAck({
                payload,
                channel: MESSAGE_TYPE.SYNC_SCENE_SESSION,
                applied: true,
            }),
        });
    };

    const handleSyncRuntimeParams = async (id, payload) => {
        const modules = RUNTIME_MODULES;
        const runtimeApply = applyRuntimeParams(
            modules,
            runtimeState,
            payload?.runtimeParams,
        );
        let waterLayerApply = null;
        const sceneRemountRequired = (
            runtimeApply?.qualityChanged === true
            || runtimeApply?.visualProfileChanged === true
        );
        const waterLayerNeedsApply = (
            sceneRemountRequired
            || runtimeApply?.waterLayerChanged === true
        );
        let remountCompleted = sceneRemountRequired !== true;
        if (
            sceneRemountRequired
            && runtimeApply?.remountPromise
            && typeof runtimeApply.remountPromise.then === 'function'
        ) {
            remountCompleted = await runtimeApply.remountPromise;
            if (remountCompleted !== true) {
                throw new Error(
                    'ZEN_POND_WORKER_RUNTIME_PARAMS_SCENE_REMOUNT_FAILED',
                );
            }
        }
        if (
            remountCompleted === true
            && runtimeState.scene?.active === true
            && waterLayerNeedsApply
        ) {
            if (
                typeof runtimeState.scene
                    .syncWaterEffectsLayerForRuntimeParams !== 'function'
            ) {
                throw new Error(
                    'ZEN_POND_WORKER_WATER_LAYER_APPLY_SEAM_MISSING',
                );
            }
            waterLayerApply = await runtimeState.scene
                .syncWaterEffectsLayerForRuntimeParams();
        } else if (
            remountCompleted === true
            && runtimeState.scene?.active === true
        ) {
            if (
                typeof runtimeState.scene
                    .getWaterEffectsLayerApplyState !== 'function'
            ) {
                throw new Error(
                    'ZEN_POND_WORKER_WATER_LAYER_STATE_SEAM_MISSING',
                );
            }
            waterLayerApply = runtimeState.scene
                .getWaterEffectsLayerApplyState();
        } else {
            waterLayerApply = {
                requested: runtimeApply?.waterLayerRequested === true,
                requestedSignature:
                    typeof runtimeApply?.waterLayerRequestedSignature === 'string'
                        ? runtimeApply.waterLayerRequestedSignature
                        : '',
                activeSignature: '',
                status: (
                    sceneRemountRequired
                    && remountCompleted !== true
                )
                    ? 'scene_remount_pending'
                    : 'scene_not_mounted',
                ready: false,
                pending: true,
                failed: false,
                error: '',
            };
        }
        recordZenPondRuntimeHealthEvent(runtimeState, 'runtime_params_applied', {
            source: 'sync_runtime_params',
            count: runtimeState.metrics?.runtimeParamSyncCount || 0,
            waterLayerApply,
        });
        if (runtimeState.refs?.frameStateRef?.current) {
            recordZenPondRuntimeHealthEvent(runtimeState, 'frame_state_ready', {
                source: 'sync_runtime_params',
            });
        } else {
            recordZenPondRuntimeHealthEvent(runtimeState, 'frame_state_missing', {
                source: 'sync_runtime_params',
            }, {
                captureStack: true,
                stackKey: 'frame_state_missing_after_sync_runtime_params',
            });
        }
        const waterLayerApplied = (
            waterLayerNeedsApply
            && waterLayerApply?.ready === true
        );
        respondResult(id, {
            synced: true,
            qualityMode: runtimeState.qualityMode,
            targetFps: runtimeState.qualityProfile?.targetFps || runtimeState.runtimeParams.targetFps,
            qualityChanged: runtimeApply?.qualityChanged === true,
            visualProfileChanged: runtimeApply?.visualProfileChanged === true,
            sceneRemountRequired,
            sceneRemounted: sceneRemountRequired && remountCompleted === true,
            waterLayerChanged: runtimeApply?.waterLayerChanged === true,
            waterLayerApplyRequired: waterLayerNeedsApply,
            waterLayerApplied,
            waterLayerApply,
            ack: buildControlAck({
                payload,
                channel: MESSAGE_TYPE.SYNC_RUNTIME_PARAMS,
                applied: true,
            }),
        });
    };

    const handleSyncEnvironmentAuthority = async (id, payload) => {
        if (typeof applyEnvironmentAuthority !== 'function') {
            throw new Error('ZEN_POND_WORKER_ENVIRONMENT_AUTHORITY_APPLY_SEAM_MISSING');
        }
        const result = applyEnvironmentAuthority(
            RUNTIME_MODULES,
            runtimeState,
            payload?.envAuthority,
        );
        recordZenPondRuntimeHealthEvent(runtimeState, 'environment_authority_applied', {
            source: 'sync_environment_authority',
            changed: result?.changed === true,
            workerClockOwned: result?.solarSyncEnabled === true,
        });
        respondResult(id, {
            synced: true,
            changed: result?.changed === true,
            workerClockOwned: result?.solarSyncEnabled === true,
            ack: buildControlAck({
                payload,
                channel: MESSAGE_TYPE.SYNC_ENVIRONMENT_AUTHORITY,
                applied: true,
            }),
        });
    };

    const handleSyncFishRoster = async (id, payload) => {
        const modules = RUNTIME_MODULES;
        runtimeState.requiredFirstFrameFishCount = Math.max(
            0,
            Math.floor(Number(payload?.requiredFirstFrameFishCount) || 0),
        );
        const presentationSceneCommitRequest = applyFishRoster(
            modules,
            runtimeState,
            payload?.fishRoster,
            payload,
        );
        respondResult(id, {
            synced: true,
            fishCount: Array.isArray(runtimeState.refs.fishRef.current)
                ? runtimeState.refs.fishRef.current.length
                : 0,
            requiredFirstFrameFishCount: runtimeState.requiredFirstFrameFishCount,
            presentationSceneCommitKey:
                presentationSceneCommitRequest?.presentationSceneCommitKey || null,
            ack: buildControlAck({
                payload,
                channel: MESSAGE_TYPE.SYNC_FISH_ROSTER,
                applied: true,
            }),
        });
    };

    return {
        handleSyncSceneSession,
        handleSyncEnvironmentAuthority,
        handleSyncRuntimeParams,
        handleSyncFishRoster,
    };
};
