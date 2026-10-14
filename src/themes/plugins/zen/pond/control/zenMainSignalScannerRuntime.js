import { createZenPondWorkerRendererController } from './ZenPondWorkerRuntimeClient.js';
import { emitZenTrace } from '@zen-trace';

const PARK_HOST_ID = 'zen-main-signal-scanner-park-host';
const PARK_DISPOSE_DELAY_MS = 120000;

let mainSignalScannerController = null;
let mainSignalScannerResetToken = 0;
let mainSignalScannerLeaseSequence = 0;
let activeMainSignalScannerLeaseId = 0;
let parkDisposeTimerId = 0;
let parkHost = null;

function clearParkDisposeTimer() {
    if (!parkDisposeTimerId) return;
    clearTimeout(parkDisposeTimerId);
    parkDisposeTimerId = 0;
}

function ensureParkHost() {
    if (typeof document === 'undefined') return null;
    if (parkHost?.isConnected === true) {
        return parkHost;
    }

    const existing = document.getElementById(PARK_HOST_ID);
    if (existing) {
        parkHost = existing;
        return parkHost;
    }

    const nextHost = document.createElement('div');
    nextHost.id = PARK_HOST_ID;
    nextHost.setAttribute('aria-hidden', 'true');
    nextHost.style.position = 'fixed';
    nextHost.style.left = '-10000px';
    nextHost.style.top = '0';
    nextHost.style.width = '1px';
    nextHost.style.height = '1px';
    nextHost.style.overflow = 'hidden';
    nextHost.style.pointerEvents = 'none';
    nextHost.style.opacity = '0';
    nextHost.style.contain = 'strict';
    document.body.appendChild(nextHost);
    parkHost = nextHost;
    return parkHost;
}

function disposeMainSignalScannerController(reason = 'dispose') {
    clearParkDisposeTimer();
    if (mainSignalScannerController) {
        emitZenTrace('pond_main_runtime:dispose_controller', { reason });
        mainSignalScannerController.dispose({ reason });
    }
    mainSignalScannerController = null;
    mainSignalScannerResetToken = 0;
    activeMainSignalScannerLeaseId = 0;
}

function shouldRecreateController(nextResetToken) {
    if (!mainSignalScannerController) return true;
    const state = typeof mainSignalScannerController.getState === 'function'
        ? mainSignalScannerController.getState()
        : 'attached';
    if (state === 'disposed' || state === 'error') return true;
    return nextResetToken !== mainSignalScannerResetToken;
}

function scheduleParkDispose() {
    clearParkDisposeTimer();
    const scheduledController = mainSignalScannerController;
    parkDisposeTimerId = setTimeout(() => {
        if (!scheduledController || mainSignalScannerController !== scheduledController) {
            return;
        }
        emitZenTrace('pond_main_runtime:park_timeout_dispose');
        disposeMainSignalScannerController('main_runtime_park_timeout');
    }, PARK_DISPOSE_DELAY_MS);
}

export function acquireZenMainSignalScannerRuntime(options = {}) {
    const nextResetToken = Math.max(0, Math.floor(Number(options?.hardResetToken) || 0));
    let retainedControllerReused = false;
    if (shouldRecreateController(nextResetToken)) {
        if (mainSignalScannerController) {
            disposeMainSignalScannerController('main_runtime_recreated');
        }
        emitZenTrace('pond_main_runtime:create_controller', {
            hardResetToken: nextResetToken,
        });
        mainSignalScannerController = createZenPondWorkerRendererController(options);
        mainSignalScannerResetToken = nextResetToken;
    } else {
        retainedControllerReused = true;
        emitZenTrace('pond_main_runtime:reuse_controller', {
            hardResetToken: nextResetToken,
        });
        mainSignalScannerController.updateOptions(options);
    }

    clearParkDisposeTimer();
    if (options?.backgroundHost) {
        emitZenTrace('pond_main_runtime:attach_to_host');
        mainSignalScannerController.attachToHost(options.backgroundHost);
        if (retainedControllerReused) {
            if (
                typeof mainSignalScannerController.replayCommittedPresentationSceneAck
                !== 'function'
            ) {
                throw new Error('ZEN_MAIN_SIGNAL_SCANNER_RETAINED_ACK_REPLAY_REQUIRED');
            }
            const replayed = mainSignalScannerController.replayCommittedPresentationSceneAck();
            emitZenTrace('pond_main_runtime:retained_scene_ack_replay', {
                replayed: replayed === true,
            });
        }
    }

    mainSignalScannerLeaseSequence += 1;
    const leaseId = mainSignalScannerLeaseSequence;
    const leasedController = mainSignalScannerController;
    activeMainSignalScannerLeaseId = leaseId;

    return {
        controller: leasedController,
        release({ reason = 'main_tab_hidden' } = {}) {
            if (
                activeMainSignalScannerLeaseId !== leaseId
                || mainSignalScannerController !== leasedController
            ) {
                emitZenTrace('pond_main_runtime:ignore_stale_release', {
                    reason,
                    leaseId,
                    activeLeaseId: activeMainSignalScannerLeaseId,
                });
                return false;
            }
            activeMainSignalScannerLeaseId = 0;
            const nextParkHost = ensureParkHost();
            emitZenTrace('pond_main_runtime:release_to_park', {
                reason,
                leaseId,
                hasParkHost: Boolean(nextParkHost),
            });
            leasedController.park({ parkHost: nextParkHost });
            scheduleParkDispose();
            return true;
        },
        dispose({ reason = 'main_runtime_forced_dispose' } = {}) {
            if (
                activeMainSignalScannerLeaseId !== leaseId
                || mainSignalScannerController !== leasedController
            ) {
                emitZenTrace('pond_main_runtime:ignore_stale_dispose', {
                    reason,
                    leaseId,
                    activeLeaseId: activeMainSignalScannerLeaseId,
                });
                return false;
            }
            disposeMainSignalScannerController(reason);
            return true;
        },
    };
}

export function disposeZenMainSignalScannerRuntime(reason = 'main_runtime_dispose') {
    disposeMainSignalScannerController(reason);
}

export const ZEN_MAIN_SIGNAL_SCANNER_PARK_DISPOSE_DELAY_MS = PARK_DISPOSE_DELAY_MS;
