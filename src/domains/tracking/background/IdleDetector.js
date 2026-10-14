/**
 * IdleDetector
 *
 * 시스템 유휴 상태를 감지하고 관리하는 모듈입니다.
 */

const IDLE_DETECTION_SECONDS = 60;
const IDLE_STATE_CACHE_TTL_MS = 10_000;
const REQUIRED_IDLE_BROWSER_PORT_METHODS = Object.freeze([
    'idleOnStateChangedAddListener',
    'idleQueryState',
    'idleSetDetectionInterval',
]);

function resolveIdleBrowserPort(browserPort) {
    const missingMethod = REQUIRED_IDLE_BROWSER_PORT_METHODS
        .find((method) => typeof browserPort?.[method] !== 'function');
    if (missingMethod) {
        throw new Error(`IDLE_BROWSER_PORT_METHOD_REQUIRED:${missingMethod}`);
    }
    return browserPort;
}

function rejectMissingIdleBrowserPort() {
    throw new Error('IDLE_BROWSER_PORT_REQUIRED');
}

async function rejectMissingIdleBrowserPortAsync() {
    throw new Error('IDLE_BROWSER_PORT_REQUIRED');
}

export function createIdleDetector({ browserPort } = {}) {
    const resolvedBrowserPort = resolveIdleBrowserPort(browserPort);
    let idleState = 'active';
    let lastIdleStateCheck = 0;
    let onIdleStateChangeCallback = null;
    let runAdmittedIdleTask = null;

    async function handleIdleStateChange(state) {
        const nextState = state || idleState;
        const now = Date.now();

        if (nextState === idleState) {
            lastIdleStateCheck = now;
            return;
        }

        const prevState = idleState;
        idleState = nextState;
        lastIdleStateCheck = now;

        if (onIdleStateChangeCallback) {
            await onIdleStateChangeCallback({
                prevState,
                nextState,
                timestamp: now,
            });
        }
    }

    function runAdmittedIdleOperation(label, task) {
        if (typeof runAdmittedIdleTask !== 'function') {
            throw new Error('IDLE_PROFILE_MUTATION_ADMISSION_REQUIRED');
        }
        const admitted = runAdmittedIdleTask({
            label,
            task,
        });
        if (!admitted || typeof admitted.then !== 'function') {
            throw new Error('IDLE_PROFILE_MUTATION_ADMISSION_TASK_INVALID');
        }
        return admitted;
    }

    function runAdmittedIdleStateChange(state, label) {
        return runAdmittedIdleOperation(label, () => handleIdleStateChange(state));
    }

    /**
     * 유휴 상태 감지를 설정합니다.
     * @param {Function} onStateChange - 상태 변경 시 호출될 콜백
     */
    async function setupIdleDetection(onStateChange, { runAdmittedTask } = {}) {
        if (typeof onStateChange !== 'function') {
            throw new Error('IDLE_STATE_CHANGE_OWNER_REQUIRED');
        }
        if (typeof runAdmittedTask !== 'function') {
            throw new Error('IDLE_PROFILE_MUTATION_ADMISSION_REQUIRED');
        }
        onIdleStateChangeCallback = onStateChange;
        runAdmittedIdleTask = runAdmittedTask;

        resolvedBrowserPort.idleSetDetectionInterval(IDLE_DETECTION_SECONDS);
        resolvedBrowserPort.idleOnStateChangedAddListener((state) => {
            void runAdmittedIdleStateChange(state, 'idle_state_changed').catch((error) => {
                console.error('[IdleDetector] State transition failed:', error);
            });
        });

        await runAdmittedIdleOperation(
            'idle_initial_state_query',
            async () => {
                const state = await resolvedBrowserPort.idleQueryState(IDLE_DETECTION_SECONDS);
                if (state) await handleIdleStateChange(state);
            },
        );
    }

    /**
     * 현재 유휴 상태를 조회합니다.
     * @param {{ force?: boolean }} options
     * @returns {Promise<string>}
     */
    async function getIdleState({ force = false } = {}) {
        const now = Date.now();
        if (!force && now - lastIdleStateCheck < IDLE_STATE_CACHE_TTL_MS) {
            return idleState;
        }

        return runAdmittedIdleOperation(
            'idle_state_query',
            async () => {
                lastIdleStateCheck = now;
                const state = await resolvedBrowserPort.idleQueryState(IDLE_DETECTION_SECONDS);
                if (state) await handleIdleStateChange(state);
                return idleState;
            },
        );
    }

    /**
     * 현재 캐시된 유휴 상태를 반환합니다.
     * @returns {string}
     */
    function getCurrentIdleState() {
        return idleState;
    }

    /**
     * 유휴 상태가 활성 상태인지 확인합니다.
     * @returns {boolean}
     */
    function isActive() {
        return idleState === 'active';
    }

    return {
        getCurrentIdleState,
        getIdleState,
        isActive,
        setupIdleDetection,
    };
}

const defaultIdleDetector = Object.freeze({
    getCurrentIdleState: rejectMissingIdleBrowserPort,
    getIdleState: rejectMissingIdleBrowserPortAsync,
    isActive: rejectMissingIdleBrowserPort,
    setupIdleDetection: rejectMissingIdleBrowserPort,
});

export function setupIdleDetection(...args) {
    return defaultIdleDetector.setupIdleDetection(...args);
}

export function getIdleState(...args) {
    return defaultIdleDetector.getIdleState(...args);
}

export function getCurrentIdleState(...args) {
    return defaultIdleDetector.getCurrentIdleState(...args);
}

export function isActive(...args) {
    return defaultIdleDetector.isActive(...args);
}
