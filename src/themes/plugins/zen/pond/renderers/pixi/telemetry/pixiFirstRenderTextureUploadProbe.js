const PIXI_FIRST_RENDER_TEXTURE_UPLOAD_PROBE_BUILD_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);

const MAX_REPORTED_TEXTURE_UPLOADS = 16;

const nowMs = () => (
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()
);

const roundMetricMs = (value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Number(numeric.toFixed(4)));
};

const resolveConstructorName = (value, fallback) => {
    const name = value?.constructor?.name;
    return typeof name === 'string' && name.trim() ? name.trim() : fallback;
};

const createDisabledSnapshot = (reason) => Object.freeze({
    enabled: false,
    reason,
    count: 0,
    totalMs: 0,
    totalBytes: 0,
    topUploads: Object.freeze([]),
});

export const createPixiFirstRenderTextureUploadProbe = ({ renderer, enabled = false, clock = nowMs } = {}) => {
    if (PIXI_FIRST_RENDER_TEXTURE_UPLOAD_PROBE_BUILD_ENABLED !== true) {
        const snapshot = createDisabledSnapshot('build_capability_disabled');
        return Object.freeze({
            start: () => false,
            setPhase: () => false,
            finish: () => snapshot,
            dispose: () => false,
        });
    }

    if (enabled !== true) {
        const snapshot = createDisabledSnapshot('telemetry_disabled');
        return Object.freeze({
            start: () => false,
            setPhase: () => false,
            finish: () => snapshot,
            dispose: () => false,
        });
    }

    const textureSystem = renderer?.texture;
    if (!textureSystem || typeof textureSystem.updateTexture !== 'function') {
        const snapshot = createDisabledSnapshot('texture_system_unavailable');
        return Object.freeze({
            start: () => false,
            setPhase: () => false,
            finish: () => snapshot,
            dispose: () => false,
        });
    }

    const originalUpdateTexture = textureSystem.updateTexture;
    const originalDescriptor = Object.getOwnPropertyDescriptor(textureSystem, 'updateTexture');
    let active = false;
    let finished = false;
    let phase = 'world';
    let totalMs = 0;
    let totalBytes = 0;
    let count = 0;
    let admissionOrdinal = 0;
    let observationFailureCount = 0;
    const uploads = [];
    const phaseTotals = new Map();

    const restore = () => {
        if (!active) return false;
        if (textureSystem.updateTexture !== wrappedUpdateTexture) {
            throw new Error('ZEN_PIXI_TEXTURE_UPLOAD_PROBE_OWNER_CONFLICT');
        }
        if (originalDescriptor) Object.defineProperty(textureSystem, 'updateTexture', originalDescriptor);
        else delete textureSystem.updateTexture;
        active = false;
        return true;
    };

    const wrappedUpdateTexture = function wrappedPixiTextureUpdate(...args) {
        const ordinal = ++admissionOrdinal;
        let startedMs;
        try {
            startedMs = clock();
            if (startedMs === undefined) observationFailureCount += 1;
        } catch {
            observationFailureCount += 1;
        }
        try {
            return originalUpdateTexture.apply(this, args);
        } finally {
            count += 1;
            try {
                if (startedMs !== undefined) {
                    const baseTexture = args[0];
                    const completedMs = clock();
                    const durationMs = roundMetricMs(completedMs - startedMs);
                    const hasValidTimestamps = Number.isFinite(startedMs)
                        && startedMs >= 0 && Number.isFinite(completedMs) && completedMs >= startedMs;
                    if (!hasValidTimestamps) observationFailureCount += 1;
                    const width = Math.max(0, Math.round(Number(baseTexture?.realWidth) || 0));
                    const height = Math.max(0, Math.round(Number(baseTexture?.realHeight) || 0));
                    const bytes = width * height * 4;
                    const resource = baseTexture?.resource || null;
                    const source = resource?.source || null;
                    const entry = {
                        ordinal,
                        startedAtMs: hasValidTimestamps ? roundMetricMs(startedMs) : null,
                        completedAtMs: hasValidTimestamps ? roundMetricMs(completedMs) : null,
                        phase, durationMs, width, height, bytes,
                        resourceType: resolveConstructorName(resource, 'none'),
                        sourceType: resolveConstructorName(source, 'none'),
                        textureUid: Number.isFinite(baseTexture?.uid) ? baseTexture.uid : null,
                        sourceBytes: ArrayBuffer.isView(resource?.data) ? resource.data.byteLength : 0,
                    };
                    totalMs += durationMs;
                    totalBytes += bytes;
                    let phaseTotal = phaseTotals.get(phase);
                    if (!phaseTotal) {
                        phaseTotal = { phase, count: 0, totalMs: 0, totalBytes: 0 };
                        phaseTotals.set(phase, phaseTotal);
                    }
                    phaseTotal.count += 1;
                    phaseTotal.totalMs += durationMs;
                    phaseTotal.totalBytes += bytes;
                    uploads.push(entry);
                    uploads.sort((a, b) => b.durationMs - a.durationMs);
                    if (uploads.length > MAX_REPORTED_TEXTURE_UPLOADS) uploads.pop();
                }
            } catch {
                // Optional observation must preserve the native return/error.
                observationFailureCount += 1;
            }
        }
    };

    const buildSnapshot = () => Object.freeze({
        enabled: true,
        reason: null,
        scope: 'first_pond_tick',
        timingScope: 'Original Pixi updateTexture wall time, including driver waits and texture style; not GPU time. Bytes are RGBA8 area estimates; sourceBytes reports typed-buffer length.',
        count,
        omittedUploadCount: count - uploads.length,
        observationFailureCount,
        totalMs: roundMetricMs(totalMs),
        totalBytes,
        phaseTotals: Object.freeze([...phaseTotals.values()].map(entry => Object.freeze({
            ...entry, totalMs: roundMetricMs(entry.totalMs),
        }))),
        topUploads: Object.freeze(
            [...uploads]
                .sort((a, b) => b.durationMs - a.durationMs)
                .slice(0, MAX_REPORTED_TEXTURE_UPLOADS)
                .map((entry) => Object.freeze({ ...entry })),
        ),
    });

    return Object.freeze({
        start() {
            if (finished) {
                throw new Error('ZEN_PIXI_TEXTURE_UPLOAD_PROBE_ALREADY_FINISHED');
            }
            if (active) return false;
            if (textureSystem.updateTexture !== originalUpdateTexture) {
                throw new Error('ZEN_PIXI_TEXTURE_UPLOAD_PROBE_OWNER_CONFLICT');
            }
            textureSystem.updateTexture = wrappedUpdateTexture;
            active = true;
            return true;
        },
        setPhase(nextPhase) {
            if (!active) return false;
            const normalized = typeof nextPhase === 'string' ? nextPhase.trim() : '';
            if (!normalized || normalized.length > 40 || (!phaseTotals.has(normalized) && phaseTotals.size >= 16)) {
                throw new Error('ZEN_PIXI_TEXTURE_UPLOAD_PROBE_PHASE_REQUIRED');
            }
            phase = normalized;
            return true;
        },
        finish() {
            restore();
            finished = true;
            return buildSnapshot();
        },
        dispose() {
            return restore();
        },
    });
};
