import { createZenRendererWorkJournal } from './zenRendererWorkJournal.js';

const BONSAI_RENDERER_REPORT_SCALARS = new Set([
    'rendererTreeSetPlanApplied',
    'rendererTreeFullBakeCount',
    'rendererTreePartialBakeCount',
    'rendererTreeReuseCount',
    'rendererTreeFlowerAtlasBakeCount',
    'rendererTreePaintedRuns',
    'rendererTreeReusedRuns',
    'rendererTreeUpdatedAtlases',
]);

export const createZenHomeRendererWorkJournal = (options) => {
    const journal = createZenRendererWorkJournal(options);
    let lastSceneSessionId = null;
    let lastSceneSequence = 0;
    return Object.freeze({
        recordBonsaiFrame(payload, { receivedAtMs, channelSessionId }) {
            const timing = payload?.workerTiming;
            if (!timing) return;
            const workerTiming = Object.fromEntries(Object.entries(timing).filter(
                ([key, value]) => (key.endsWith('Ms') || BONSAI_RENDERER_REPORT_SCALARS.has(key))
                    && (value === null || Number.isFinite(value)),
            ));
            const identity = {
                channel: 'bonsai',
                channelSessionId,
                sceneSequence: timing.sceneSequence,
                sceneSignature: payload.sceneSignature,
                sceneCommitKey: payload.sceneCommitKey,
                frameCount: payload.frameCount,
                receivedAtMs,
            };
            if (
                Number.isInteger(timing.sceneSequence) && timing.sceneSequence > 0
                && (
                    channelSessionId !== lastSceneSessionId
                    || timing.sceneSequence !== lastSceneSequence
                )
            ) {
                journal.append({
                    ...identity,
                    event: 'bonsai_scene',
                    atMs: timing.sceneReceivedAtMs,
                    sceneSyncMs: timing.scenePreRenderRequestMs,
                    workerTiming,
                });
                lastSceneSessionId = channelSessionId;
                lastSceneSequence = timing.sceneSequence;
            }
            journal.append({
                ...identity,
                event: 'bonsai_frame',
                atMs: timing.frameRequestedAtMs,
                workerTiming,
                staticLayersRebaked: payload.staticLayersRebaked === true,
                branchRigRebuilt: payload.branchRigRebuilt === true,
            });
        },
        snapshot: journal.snapshot,
    });
};
