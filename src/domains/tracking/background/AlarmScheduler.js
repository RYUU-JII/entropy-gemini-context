/**
 * AlarmScheduler
 * 
 * Tracking 알람 이름과 생성 계약을 관리하는 모듈입니다.
 */

const ALARM_NAME = 'oneMinuteTick';
const NUDGE_SWEEP_ALARM_NAME = 'nudgePendingSweep';
const ALARM_PERIOD_MINUTES = 1;

function resolveAlarmBrowserPort(browserPort) {
    if (
        typeof browserPort?.alarmsGet !== 'function'
        || typeof browserPort?.alarmsCreate !== 'function'
    ) {
        throw new Error('TRACKING_ALARM_BROWSER_PORT_REQUIRED');
    }
    return browserPort;
}

async function ensureNamedAlarm(browserPort, alarmName) {
    const existingAlarm = await browserPort.alarmsGet(alarmName);
    if (existingAlarm) return;
    await browserPort.alarmsCreate(alarmName, { periodInMinutes: ALARM_PERIOD_MINUTES });
    console.log('[AlarmScheduler] Alarm created:', alarmName);
}

/**
 * 1분 주기 알람이 설정되어 있는지 확인하고 없으면 생성합니다.
 */
export async function ensureAlarm({ browserPort } = {}) {
    const resolvedBrowserPort = resolveAlarmBrowserPort(browserPort);
    await Promise.all([
        ensureNamedAlarm(resolvedBrowserPort, ALARM_NAME),
        ensureNamedAlarm(resolvedBrowserPort, NUDGE_SWEEP_ALARM_NAME),
    ]);
}

/**
 * 알람 이름을 반환합니다.
 * @returns {string}
 */
export function getAlarmName() {
    return ALARM_NAME;
}

/**
 * Nudge pending sweep 알람 이름을 반환합니다.
 * @returns {string}
 */
export function getNudgeSweepAlarmName() {
    return NUDGE_SWEEP_ALARM_NAME;
}
