/**
 * CLSE Message Handler
 * 
 * Handles messages from the dashboard CLSE tab for:
 * - Status queries
 * - Enable/disable
 * - Data retrieval
 */

import {
    getCLSEStatus,
    resetCLSEBaseline,
    getCLSERecentEvents,
} from '../../behavior/CLSEServiceClient.js';
import { CLSE_CONSTANTS } from '../../behavior/clseSchema.js';
import { requireCanonicalCLSEStatusSnapshot } from '../../behavior/clseStatusContract.js';
import {
    CLSE_ALERT_COOLDOWN_KEY,
    normalizeCLSEAlertCooldown,
    normalizeCLSESensitivityScale,
} from '../../behavior/clseSettings.js';
import { isTrustedExtensionPageSender } from '../../../platform/security/senderTrust.js';

const CLSE_LOG_RANGE_DEFAULT_MS = 60 * 60 * 1000;
const CLSE_LOG_RANGE_MIN_MS = 60 * 1000;
const CLSE_LOG_RANGE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const CLSE_LOG_LIMIT_DEFAULT = 200;
const CLSE_LOG_LIMIT_MIN = 1;
const CLSE_LOG_LIMIT_MAX = 1000;
const CLSE_STATUS_RESPONSE_INVALID = 'CLSE_STATUS_RESPONSE_INVALID';
const CLSE_EVENTS_QUERY_INVALID_RESULT = 'CLSE_EVENTS_QUERY_INVALID_RESULT';
const CLSE_SETTING_PAYLOAD_INVALID = 'CLSE_SETTING_PAYLOAD_INVALID';
const CLSE_SETTINGS_COMMIT_ACK_INVALID = 'CLSE_SETTINGS_COMMIT_ACK_INVALID';

export const CLSE_MESSAGE_TYPES = {
    CLSE_GET_STATUS: 'CLSE_GET_STATUS',
    CLSE_SET_ENABLED: 'CLSE_SET_ENABLED',
    CLSE_SET_SENSITIVITY: 'CLSE_SET_SENSITIVITY',
    CLSE_SET_ALERT_COOLDOWN: 'CLSE_SET_ALERT_COOLDOWN',
    CLSE_GET_BUCKETS: 'CLSE_GET_BUCKETS',
    CLSE_RESET_BASELINE: 'CLSE_RESET_BASELINE',
    CLSE_GET_AGGRESSION_LOGS: 'CLSE_GET_AGGRESSION_LOGS',
};

function clampNumber(value, { min, max, fallback }) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function requireBooleanPayload(value, fieldName) {
    if (typeof value !== 'boolean') {
        throw new Error(`${CLSE_SETTING_PAYLOAD_INVALID}:${fieldName}`);
    }
    return value;
}

function requireNumericPayload(value, fieldName) {
    if (typeof value === 'string' && !value.trim()) {
        throw new Error(`${CLSE_SETTING_PAYLOAD_INVALID}:${fieldName}`);
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        throw new Error(`${CLSE_SETTING_PAYLOAD_INVALID}:${fieldName}`);
    }
    return numeric;
}

function requireCLSEEventTimestamp(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${CLSE_EVENTS_QUERY_INVALID_RESULT}:ts`);
    }
    return value;
}

function normalizeRecentCLSEEventRows(events) {
    if (!Array.isArray(events)) {
        throw new Error(CLSE_EVENTS_QUERY_INVALID_RESULT);
    }
    return events.map((event) => {
        if (!event || typeof event !== 'object' || typeof event.type !== 'string' || !event.type.trim()) {
            throw new Error(`${CLSE_EVENTS_QUERY_INVALID_RESULT}:type`);
        }
        return {
            ...event,
            type: event.type.trim(),
            ts: requireCLSEEventTimestamp(event.ts),
        };
    });
}

function normalizeLoopCLSEEventRows(events) {
    if (!Array.isArray(events)) {
        throw new Error(CLSE_EVENTS_QUERY_INVALID_RESULT);
    }
    return events.map((event) => {
        if (!event || typeof event !== 'object') {
            throw new Error(CLSE_EVENTS_QUERY_INVALID_RESULT);
        }
        const type = typeof event.type === 'string' && event.type.trim()
            ? event.type.trim()
            : typeof event.event === 'string' && event.event.trim()
                ? event.event.trim()
                : null;
        if (!type) {
            throw new Error(`${CLSE_EVENTS_QUERY_INVALID_RESULT}:type`);
        }
        return {
            type,
            ts: requireCLSEEventTimestamp(event.ts),
            data: event,
        };
    });
}

function buildCommittedCLSEStatus(result, requiredKey) {
    const committedItems = result?.committedItems;
    if (
        !committedItems
        || typeof committedItems !== 'object'
        || Array.isArray(committedItems)
        || !Object.prototype.hasOwnProperty.call(committedItems, requiredKey)
    ) {
        throw new Error(CLSE_SETTINGS_COMMIT_ACK_INVALID);
    }
    const status = {
        ...getCLSEStatus(),
    };
    if (Object.prototype.hasOwnProperty.call(committedItems, CLSE_CONSTANTS.FEATURE_FLAG_KEY)) {
        status.isEnabled = !!committedItems[CLSE_CONSTANTS.FEATURE_FLAG_KEY];
    }
    if (Object.prototype.hasOwnProperty.call(committedItems, CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY)) {
        status.sensitivityScale = normalizeCLSESensitivityScale(
            committedItems[CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY],
        );
    }
    if (Object.prototype.hasOwnProperty.call(committedItems, CLSE_ALERT_COOLDOWN_KEY)) {
        status.alertCooldownMs = normalizeCLSEAlertCooldown(
            committedItems[CLSE_ALERT_COOLDOWN_KEY],
        );
    }
    return requireCanonicalCLSEStatusSnapshot(status, CLSE_STATUS_RESPONSE_INVALID);
}

/**
 * Create CLSE message handler
 */
export function createCLSEMessageHandler({
    applyCLSESettingsPatch,
    clseRepository,
} = {}) {
    if (typeof applyCLSESettingsPatch !== 'function') {
        throw new Error('CLSE_SETTINGS_PIPELINE_OWNER_REQUIRED');
    }
    if (
        !clseRepository
        || typeof clseRepository.init !== 'function'
        || typeof clseRepository.getBuckets60s !== 'function'
        || typeof clseRepository.getLoopEvents !== 'function'
        || typeof clseRepository.getAggressionLogs !== 'function'
    ) {
        throw new Error('CLSE_MESSAGE_HANDLER_CLSE_REPOSITORY_REQUIRED');
    }

    const persistCLSESettingsPatch = async ({ items, sender, actionReason }) => {
        return applyCLSESettingsPatch({
            items,
            sender,
            actionReason,
        });
    };

    const handleMessage = async (message, sender, sendResponse) => {
        const { type, payload } = message || {};

        if (!isTrustedExtensionPageSender(sender)) {
            sendResponse({ success: false, error: 'UNAUTHORIZED_CLSE_SENDER' });
            return true;
        }

        if (!Object.values(CLSE_MESSAGE_TYPES).includes(type)) {
            return false;
        }

        try {
            switch (type) {
                case CLSE_MESSAGE_TYPES.CLSE_GET_STATUS: {
                    sendResponse(requireCanonicalCLSEStatusSnapshot(
                        getCLSEStatus(),
                        CLSE_STATUS_RESPONSE_INVALID,
                    ));
                    return true;
                }

                case CLSE_MESSAGE_TYPES.CLSE_SET_ENABLED: {
                    const { enabled } = payload || {};
                    const result = await persistCLSESettingsPatch({
                        items: {
                            [CLSE_CONSTANTS.FEATURE_FLAG_KEY]: requireBooleanPayload(enabled, 'enabled'),
                        },
                        sender,
                        actionReason: 'clse_set_enabled',
                    });
                    sendResponse(buildCommittedCLSEStatus(result, CLSE_CONSTANTS.FEATURE_FLAG_KEY));
                    return true;
                }

                case CLSE_MESSAGE_TYPES.CLSE_SET_SENSITIVITY: {
                    const { scale } = payload || {};
                    const requestedScale = requireNumericPayload(scale, 'sensitivityScale');
                    const result = await persistCLSESettingsPatch({
                        items: {
                            [CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY]: normalizeCLSESensitivityScale(requestedScale),
                        },
                        sender,
                        actionReason: 'clse_set_sensitivity',
                    });
                    sendResponse(buildCommittedCLSEStatus(result, CLSE_CONSTANTS.SENSITIVITY_SCALE_KEY));
                    return true;
                }

                case CLSE_MESSAGE_TYPES.CLSE_SET_ALERT_COOLDOWN: {
                    const { cooldownMs } = payload || {};
                    const requestedCooldownMs = requireNumericPayload(cooldownMs, 'alertCooldownMs');
                    const result = await persistCLSESettingsPatch({
                        items: {
                            [CLSE_ALERT_COOLDOWN_KEY]: normalizeCLSEAlertCooldown(requestedCooldownMs),
                        },
                        sender,
                        actionReason: 'clse_set_alert_cooldown',
                    });
                    sendResponse(buildCommittedCLSEStatus(result, CLSE_ALERT_COOLDOWN_KEY));
                    return true;
                }

                case CLSE_MESSAGE_TYPES.CLSE_GET_BUCKETS: {
                    try {
                        await clseRepository.init();
                        const endTs = Date.now();
                        const startTs = endTs - (60 * 60 * 1000);
                        const buckets60s = await clseRepository.getBuckets60s({ startTs, endTs });
                        const loopEvents = await clseRepository.getLoopEvents({ startTs, endTs });
                        if (!Array.isArray(buckets60s) || !Array.isArray(loopEvents)) {
                            throw new Error('CLSE_BUCKETS_QUERY_INVALID_RESULT');
                        }
                        const recentEvents = normalizeRecentCLSEEventRows(getCLSERecentEvents());
                        const normalizedLoopEvents = normalizeLoopCLSEEventRows(loopEvents);

                        const combinedEvents = [
                            ...recentEvents,
                            ...normalizedLoopEvents,
                        ].sort((a, b) => b.ts - a.ts).slice(0, 50);

                        sendResponse({
                            buckets60s,
                            events: combinedEvents,
                        });
                    } catch (err) {
                        console.error('[CLSE Message] Get buckets error:', err);
                        sendResponse({
                            success: false,
                            error: 'CLSE_BUCKETS_QUERY_FAILED',
                            message: err?.message || String(err || 'CLSE_BUCKETS_QUERY_FAILED'),
                        });
                    }
                    return true;
                }

                case CLSE_MESSAGE_TYPES.CLSE_RESET_BASELINE: {
                    await resetCLSEBaseline();
                    sendResponse(requireCanonicalCLSEStatusSnapshot(
                        getCLSEStatus(),
                        CLSE_STATUS_RESPONSE_INVALID,
                    ));
                    return true;
                }

                case CLSE_MESSAGE_TYPES.CLSE_GET_AGGRESSION_LOGS: {
                    try {
                        await clseRepository.init();
                        const endTs = Date.now();
                        const rangeMs = clampNumber(payload?.rangeMs, {
                            min: CLSE_LOG_RANGE_MIN_MS,
                            max: CLSE_LOG_RANGE_MAX_MS,
                            fallback: CLSE_LOG_RANGE_DEFAULT_MS,
                        });
                        const startTs = endTs - rangeMs;
                        const limit = clampNumber(payload?.limit, {
                            min: CLSE_LOG_LIMIT_MIN,
                            max: CLSE_LOG_LIMIT_MAX,
                            fallback: CLSE_LOG_LIMIT_DEFAULT,
                        });
                        const logs = await clseRepository.getAggressionLogs({ startTs, endTs, limit });
                        if (!Array.isArray(logs)) {
                            throw new Error('CLSE_AGGRESSION_LOGS_QUERY_INVALID_RESULT');
                        }
                        sendResponse({ logs });
                    } catch (err) {
                        console.error('[CLSE Message] Get aggression logs error:', err);
                        sendResponse({
                            success: false,
                            error: 'CLSE_AGGRESSION_LOGS_QUERY_FAILED',
                            message: err?.message || String(err || 'CLSE_AGGRESSION_LOGS_QUERY_FAILED'),
                        });
                    }
                    return true;
                }

                default:
                    break;
            }
        } catch (error) {
            console.error('[CLSE Message] Handler error:', error);
            sendResponse({
                success: false,
                error: error?.message || 'CLSE_MESSAGE_FAILED',
            });
        }

        return true;
    };

    return (message, sender, sendResponse) => {
        const { type } = message || {};

        if (!Object.values(CLSE_MESSAGE_TYPES).includes(type)) {
            return false;
        }

        void handleMessage(message, sender, sendResponse);
        return true;
    };
}
