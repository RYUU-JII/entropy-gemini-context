const NUDGE_WINDOW_BLUR_POLICY_DEFAULT = 'strict';
const NUDGE_WINDOW_BLUR_POLICY_GRACE = 'grace';
const NUDGE_WINDOW_BLUR_GRACE_MS_DEFAULT = 2500;
const NUDGE_WINDOW_BLUR_GRACE_MS_MIN = 250;
const NUDGE_WINDOW_BLUR_GRACE_MS_MAX = 20_000;
const NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES = Object.freeze({
    OPEN: 'open',
    QUIESCING: 'quiescing',
    QUIESCED: 'quiesced',
});

function warnNudgeWindowBlurFailure(code, error) {
    console.warn('[NudgeWindowBlurController] best-effort window-blur step failed', {
        code,
        error: error?.message || String(error || code),
    });
}

async function runNudgeWindowBlurStep(code, task) {
    if (typeof task !== 'function') {
        warnNudgeWindowBlurFailure(code, `${code}:TASK_UNAVAILABLE`);
        return null;
    }
    try {
        return await Promise.resolve(task());
    } catch (error) {
        warnNudgeWindowBlurFailure(code, error);
        return null;
    }
}

function requireNudgeWindowBlurStopOwner(stopNudgeForTab) {
    if (typeof stopNudgeForTab !== 'function') {
        throw new Error('NUDGE_WINDOW_BLUR_STOP_OWNER_REQUIRED');
    }
    return stopNudgeForTab;
}

export function createNudgeWindowBlurController({
    ensureSettingsCache = async () => { },
    getNudgeConfig = () => ({}),
    stopNudgeForTab,
} = {}) {
    const resolvedStopNudgeForTab = requireNudgeWindowBlurStopOwner(stopNudgeForTab);
    let blurTimer = null;
    let blurTabId = null;
    let profileMutationPhase = NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.OPEN;
    let profileMutationQuiescePromise = null;
    const inFlightWork = new Set();

    const clear = () => {
        if (blurTimer) {
            clearTimeout(blurTimer);
            blurTimer = null;
        }
        blurTabId = null;
    };

    const assertAdmissionOpen = () => {
        if (profileMutationPhase !== NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.OPEN) {
            throw new Error(
                `NUDGE_WINDOW_BLUR_PROFILE_MUTATION_ADMISSION_CLOSED:${profileMutationPhase}`,
            );
        }
    };

    const trackInFlightWork = (work) => {
        const pending = Promise.resolve(work);
        inFlightWork.add(pending);
        void pending.then(
            () => inFlightWork.delete(pending),
            () => inFlightWork.delete(pending),
        );
        return pending;
    };

    const getPolicyConfig = () => {
        const nudgeConfig = getNudgeConfig();

        const rawPolicy = typeof nudgeConfig?.windowBlurPolicy === 'string'
            ? nudgeConfig.windowBlurPolicy.trim().toLowerCase()
            : '';
        const policy = rawPolicy === NUDGE_WINDOW_BLUR_POLICY_GRACE
            ? NUDGE_WINDOW_BLUR_POLICY_GRACE
            : NUDGE_WINDOW_BLUR_POLICY_DEFAULT;

        const rawGraceMs = Number(nudgeConfig?.windowBlurGraceMs);
        const graceMs = Number.isFinite(rawGraceMs)
            ? Math.min(
                NUDGE_WINDOW_BLUR_GRACE_MS_MAX,
                Math.max(NUDGE_WINDOW_BLUR_GRACE_MS_MIN, Math.floor(rawGraceMs))
            )
            : NUDGE_WINDOW_BLUR_GRACE_MS_DEFAULT;

        return { policy, graceMs };
    };

    const runAdmittedWindowBlurAbort = async (tabId, now) => {
        const normalizedTabId = Number.isFinite(Number(tabId))
            ? Math.floor(Number(tabId))
            : null;
        if (normalizedTabId === null || normalizedTabId < 0) {
            clear();
            return;
        }

        await runNudgeWindowBlurStep(
            'WINDOW_BLUR_SETTINGS_CACHE_FAILED',
            ensureSettingsCache,
        );
        if (profileMutationPhase !== NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.OPEN) {
            clear();
            return;
        }
        const { policy, graceMs } = getPolicyConfig();

        if (policy !== NUDGE_WINDOW_BLUR_POLICY_GRACE) {
            clear();
            await runNudgeWindowBlurStep('WINDOW_BLUR_NUDGE_STOP_FAILED', () => resolvedStopNudgeForTab(normalizedTabId, {
                reason: 'window_blur',
                now,
            }));
            return;
        }

        clear();
        blurTabId = normalizedTabId;
        blurTimer = setTimeout(() => {
            if (profileMutationPhase !== NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.OPEN) {
                clear();
                return;
            }
            const targetTabId = blurTabId;
            clear();
            void trackInFlightWork(
                runNudgeWindowBlurStep(
                    'WINDOW_BLUR_GRACE_NUDGE_STOP_FAILED',
                    () => resolvedStopNudgeForTab(targetTabId, {
                        reason: 'window_blur',
                        now: Date.now(),
                    }),
                ),
            );
        }, graceMs);
    };

    const handleWindowBlurAbort = (tabId, now = Date.now()) => {
        assertAdmissionOpen();
        return trackInFlightWork(runAdmittedWindowBlurAbort(tabId, now));
    };

    const quiesceForProfileMutation = () => {
        if (profileMutationPhase === NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.QUIESCING) {
            return profileMutationQuiescePromise;
        }
        if (profileMutationPhase === NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.QUIESCED) {
            return Promise.resolve(Object.freeze({ quiesced: true, reused: true }));
        }

        profileMutationPhase = NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.QUIESCING;
        clear();
        const admittedWork = [...inFlightWork];
        profileMutationQuiescePromise = Promise.all(admittedWork).then(() => {
            profileMutationPhase = NUDGE_WINDOW_BLUR_PROFILE_MUTATION_PHASES.QUIESCED;
            return Object.freeze({ quiesced: true, reused: false });
        });
        return profileMutationQuiescePromise;
    };

    return {
        clear,
        getPendingTabId: () => blurTabId,
        handleWindowBlurAbort,
        quiesceForProfileMutation,
    };
}
