import { emitZenTrace } from '@zen-trace';

let traceSequence = 0;

const nowPerfMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const roundMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Number(numeric.toFixed(2)));
};

const normalizeScope = (scope) => {
    const text = typeof scope === 'string' ? scope.trim() : '';
    return text || 'zen_main_boot';
};

export function createZenMainBootTraceContext(scope = 'zen_main_boot') {
    traceSequence += 1;
    const startedAtMs = nowPerfMs();
    const safeScope = normalizeScope(scope);
    return Object.freeze({
        bootRunId: `${safeScope}_${Date.now().toString(36)}_${traceSequence}`,
        scope: safeScope,
        startedAtMs,
        createdAtWallMs: Date.now(),
    });
}

export function isZenMainBootTraceContext(value = null) {
    return Boolean(
        value
        && typeof value === 'object'
        && typeof value.bootRunId === 'string'
        && value.bootRunId
        && Number.isFinite(Number(value.startedAtMs))
    );
}

export function buildZenMainBootTraceFields(context = null) {
    if (!isZenMainBootTraceContext(context)) {
        return null;
    }
    const nowMs = nowPerfMs();
    return {
        bootRunId: context.bootRunId,
        bootTraceScope: context.scope || 'zen_main_boot',
        sinceBootTraceStartMs: roundMs(nowMs - Number(context.startedAtMs)),
    };
}

export function emitZenMainBootTrace(event, context = null, details = null) {
    const traceFields = buildZenMainBootTraceFields(context);
    if (!traceFields) {
        return emitZenTrace(event, details);
    }
    return emitZenTrace(event, {
        ...traceFields,
        ...(details && typeof details === 'object' ? details : {}),
    });
}

export function markZenMainBootTraceCheckpoint(context = null) {
    return buildZenMainBootTraceFields(context);
}
