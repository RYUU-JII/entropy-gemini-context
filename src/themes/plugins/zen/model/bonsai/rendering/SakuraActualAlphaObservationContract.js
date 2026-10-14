export const ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT =
    'zen-sakura-actual-alpha-observation-request-v1';
export const ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CONTRACT =
    'zen-sakura-actual-alpha-observation-v1';

export const ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE = 'one-shot';
export const ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE =
    'tree-only-pre-clip-viewport-device-pixel';
export const ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE =
    'transient-render-diagnostics-only';

export const ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_STATUS = Object.freeze({
    OBSERVED: 'observed',
    EMPTY: 'empty',
});

// This payload is deliberately transient. The later runtime transport must
// consume each request exactly once and must capture the tree layer before the
// viewport clip, excluding backdrop, bed, pot, and final compositor pixels.

const SUPPORTED_RENDER_BACKENDS = new Set(['canvas2d', 'pixi']);

const IDENTITY_KEYS = Object.freeze([
    'sceneSignature',
    'sceneCommitKey',
    'renderPlanSignature',
    'bonsaiMaterializationKey',
    'inputSignature',
    'surface',
]);
const SURFACE_KEYS = Object.freeze([
    'generation',
    'width',
    'height',
    'pixelRatio',
    'renderBackend',
]);
const RECT_KEYS = Object.freeze(['x', 'y', 'width', 'height']);
const REQUEST_KEYS = Object.freeze([
    'contract',
    'mode',
    'scope',
    'purpose',
    'requestId',
    'identity',
    'identityKey',
    'safeViewportRect',
    'captureRect',
    'minimumAlpha',
]);
const SAMPLE_KEYS = Object.freeze(['frameSequence', 'frameCount']);
const CAPTURE_KEYS = Object.freeze([
    'rect',
    'minimumAlpha',
    'scannedPixelCount',
    'alphaPixelCount',
]);
const BOUNDS_KEYS = Object.freeze(['minX', 'maxX', 'minY', 'maxY', 'width', 'height']);
const EDGE_KEYS = Object.freeze(['left', 'right', 'top', 'bottom']);
const OBSERVATION_KEYS = Object.freeze([
    'contract',
    'requestContract',
    'mode',
    'scope',
    'purpose',
    'requestId',
    'identity',
    'identityKey',
    'sample',
    'safeViewportRect',
    'capture',
    'status',
    'observedAlphaBounds',
    'overflowPx',
    'censoredEdges',
]);

const fail = (code, detail = '') => {
    throw new Error(detail ? `${code}:${detail}` : code);
};

const requireRecord = (value, code) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail(code);
    }
    return value;
};

const requireExactKeys = (value, expectedKeys, code) => {
    const actualKeys = Object.keys(requireRecord(value, code)).sort();
    const expected = [...expectedKeys].sort();
    if (
        actualKeys.length !== expected.length
        || actualKeys.some((key, index) => key !== expected[index])
    ) {
        fail(code, actualKeys.join(','));
    }
};

const requireNonEmptyString = (value, code) => {
    if (typeof value !== 'string' || !value || value !== value.trim()) {
        fail(code);
    }
    return value;
};

const requireInteger = (value, code, { min = Number.MIN_SAFE_INTEGER } = {}) => {
    if (!Number.isSafeInteger(value) || value < min) {
        fail(code, String(value));
    }
    return value;
};

const requireFiniteNumber = (value, code, { min = -Infinity } = {}) => {
    if (!Number.isFinite(value) || value < min) {
        fail(code, String(value));
    }
    return value;
};

const requireBoolean = (value, code) => {
    if (typeof value !== 'boolean') {
        fail(code, String(value));
    }
    return value;
};

const freezeRect = (value, code, { positiveExtent = true } = {}) => {
    requireExactKeys(value, RECT_KEYS, `${code}_SHAPE_INVALID`);
    const rect = {
        x: requireInteger(value.x, `${code}_X_INVALID`),
        y: requireInteger(value.y, `${code}_Y_INVALID`),
        width: requireInteger(value.width, `${code}_WIDTH_INVALID`, {
            min: positiveExtent ? 1 : 0,
        }),
        height: requireInteger(value.height, `${code}_HEIGHT_INVALID`, {
            min: positiveExtent ? 1 : 0,
        }),
    };
    return Object.freeze(rect);
};

const containsRect = (outer, inner) => (
    inner.x >= outer.x
    && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
);

const requireViewportCaptureRelation = ({ identity, safeViewportRect, captureRect }) => {
    const surfaceRect = {
        x: 0,
        y: 0,
        width: identity.surface.width,
        height: identity.surface.height,
    };
    if (!containsRect(surfaceRect, safeViewportRect)) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SAFE_VIEWPORT_OUTSIDE_SURFACE');
    }
    if (!containsRect(captureRect, safeViewportRect)) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CAPTURE_EXCLUDES_SAFE_VIEWPORT');
    }
};

const freezeEdgeRecord = (value, code, validator) => {
    requireExactKeys(value, EDGE_KEYS, `${code}_SHAPE_INVALID`);
    return Object.freeze({
        left: validator(value.left, `${code}_LEFT_INVALID`),
        right: validator(value.right, `${code}_RIGHT_INVALID`),
        top: validator(value.top, `${code}_TOP_INVALID`),
        bottom: validator(value.bottom, `${code}_BOTTOM_INVALID`),
    });
};

const freezeIdentity = (value) => {
    requireExactKeys(
        value,
        IDENTITY_KEYS,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_IDENTITY_SHAPE_INVALID',
    );
    requireExactKeys(
        value.surface,
        SURFACE_KEYS,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SURFACE_SHAPE_INVALID',
    );
    const renderBackend = requireNonEmptyString(
        value.surface.renderBackend,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_RENDER_BACKEND_REQUIRED',
    );
    if (!SUPPORTED_RENDER_BACKENDS.has(renderBackend)) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_RENDER_BACKEND_INVALID', renderBackend);
    }
    const surface = Object.freeze({
        generation: requireInteger(
            value.surface.generation,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SURFACE_GENERATION_INVALID',
            { min: 0 },
        ),
        width: requireInteger(
            value.surface.width,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SURFACE_WIDTH_INVALID',
            { min: 1 },
        ),
        height: requireInteger(
            value.surface.height,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SURFACE_HEIGHT_INVALID',
            { min: 1 },
        ),
        pixelRatio: requireFiniteNumber(
            value.surface.pixelRatio,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PIXEL_RATIO_INVALID',
            { min: Number.EPSILON },
        ),
        renderBackend,
    });
    return Object.freeze({
        sceneSignature: requireNonEmptyString(
            value.sceneSignature,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCENE_SIGNATURE_REQUIRED',
        ),
        sceneCommitKey: requireNonEmptyString(
            value.sceneCommitKey,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCENE_COMMIT_KEY_REQUIRED',
        ),
        renderPlanSignature: requireNonEmptyString(
            value.renderPlanSignature,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_RENDER_PLAN_SIGNATURE_REQUIRED',
        ),
        bonsaiMaterializationKey: requireNonEmptyString(
            value.bonsaiMaterializationKey,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MATERIALIZATION_KEY_REQUIRED',
        ),
        inputSignature: requireNonEmptyString(
            value.inputSignature,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_INPUT_SIGNATURE_REQUIRED',
        ),
        surface,
    });
};

export function resolveSakuraActualAlphaObservationIdentityKeyV1(identity) {
    const resolved = freezeIdentity(identity);
    return JSON.stringify([
        resolved.sceneSignature,
        resolved.sceneCommitKey,
        resolved.renderPlanSignature,
        resolved.bonsaiMaterializationKey,
        resolved.inputSignature,
        resolved.surface.generation,
        resolved.surface.width,
        resolved.surface.height,
        resolved.surface.pixelRatio,
        resolved.surface.renderBackend,
    ]);
}

const requireRequestConstants = (request) => {
    if (request.contract !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT_INVALID');
    }
    if (request.mode !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_MODE_INVALID');
    }
    if (request.scope !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_SCOPE_INVALID');
    }
    if (request.purpose !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_PURPOSE_INVALID');
    }
};

export function requireSakuraActualAlphaObservationRequestV1(value) {
    requireExactKeys(
        value,
        REQUEST_KEYS,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_SHAPE_INVALID',
    );
    requireRequestConstants(value);
    const requestId = requireNonEmptyString(
        value.requestId,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_ID_REQUIRED',
    );
    const identity = freezeIdentity(value.identity);
    const identityKey = resolveSakuraActualAlphaObservationIdentityKeyV1(identity);
    if (value.identityKey !== identityKey) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_IDENTITY_KEY_MISMATCH');
    }
    const safeViewportRect = freezeRect(
        value.safeViewportRect,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SAFE_VIEWPORT',
    );
    const captureRect = freezeRect(
        value.captureRect,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CAPTURE',
    );
    requireViewportCaptureRelation({ identity, safeViewportRect, captureRect });
    const minimumAlpha = requireInteger(
        value.minimumAlpha,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MINIMUM_ALPHA_INVALID',
        { min: 1 },
    );
    if (minimumAlpha > 255) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MINIMUM_ALPHA_INVALID', String(minimumAlpha));
    }
    return Object.freeze({
        contract: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT,
        mode: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE,
        scope: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE,
        purpose: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE,
        requestId,
        identity,
        identityKey,
        safeViewportRect,
        captureRect,
        minimumAlpha,
    });
}

export function createSakuraActualAlphaObservationRequestV1({
    requestId,
    identity,
    safeViewportRect,
    captureRect,
    minimumAlpha,
} = {}) {
    const resolvedIdentity = freezeIdentity(identity);
    return requireSakuraActualAlphaObservationRequestV1({
        contract: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT,
        mode: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE,
        scope: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE,
        purpose: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE,
        requestId,
        identity: resolvedIdentity,
        identityKey: resolveSakuraActualAlphaObservationIdentityKeyV1(resolvedIdentity),
        safeViewportRect,
        captureRect,
        minimumAlpha,
    });
}

const freezeBounds = (value) => {
    requireExactKeys(
        value,
        BOUNDS_KEYS,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_SHAPE_INVALID',
    );
    const bounds = {
        minX: requireInteger(
            value.minX,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_MIN_X_INVALID',
        ),
        maxX: requireInteger(
            value.maxX,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_MAX_X_INVALID',
        ),
        minY: requireInteger(
            value.minY,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_MIN_Y_INVALID',
        ),
        maxY: requireInteger(
            value.maxY,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_MAX_Y_INVALID',
        ),
        width: requireInteger(
            value.width,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_WIDTH_INVALID',
            { min: 1 },
        ),
        height: requireInteger(
            value.height,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_HEIGHT_INVALID',
            { min: 1 },
        ),
    };
    if (
        bounds.maxX <= bounds.minX
        || bounds.maxY <= bounds.minY
        || bounds.width !== bounds.maxX - bounds.minX
        || bounds.height !== bounds.maxY - bounds.minY
    ) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_EXTENT_INVALID');
    }
    return Object.freeze(bounds);
};

const resolveOverflow = (bounds, viewport) => Object.freeze({
    left: bounds ? Math.max(0, viewport.x - bounds.minX) : 0,
    right: bounds
        ? Math.max(0, bounds.maxX - (viewport.x + viewport.width))
        : 0,
    top: bounds ? Math.max(0, viewport.y - bounds.minY) : 0,
    bottom: bounds
        ? Math.max(0, bounds.maxY - (viewport.y + viewport.height))
        : 0,
});

const resolveCensoredEdges = (bounds, captureRect) => Object.freeze({
    left: Boolean(bounds && bounds.minX === captureRect.x),
    right: Boolean(bounds && bounds.maxX === captureRect.x + captureRect.width),
    top: Boolean(bounds && bounds.minY === captureRect.y),
    bottom: Boolean(bounds && bounds.maxY === captureRect.y + captureRect.height),
});

const requirePixelBuffer = (value, expectedLength) => {
    if (
        !ArrayBuffer.isView(value)
        || value.BYTES_PER_ELEMENT !== 1
        || value instanceof DataView
    ) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PIXEL_BUFFER_INVALID');
    }
    if (value.length !== expectedLength) {
        fail(
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PIXEL_BUFFER_LENGTH_MISMATCH',
            `${value.length}:${expectedLength}`,
        );
    }
    return value;
};

export function scanSakuraActualAlphaObservationV1({
    request,
    pixels,
    frameSequence,
    frameCount,
} = {}) {
    const resolvedRequest = requireSakuraActualAlphaObservationRequestV1(request);
    const resolvedFrameSequence = requireInteger(
        frameSequence,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_FRAME_SEQUENCE_INVALID',
        { min: 0 },
    );
    const resolvedFrameCount = requireFiniteNumber(
        frameCount,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_FRAME_COUNT_INVALID',
        { min: 0 },
    );
    // ImageData properties may live on its prototype and Pixi may add carrier
    // metadata, so validate the required sample fields instead of its keys.
    requireRecord(pixels, 'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PIXELS_SHAPE_INVALID');
    const width = requireInteger(
        pixels.width,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PIXELS_WIDTH_INVALID',
        { min: 1 },
    );
    const height = requireInteger(
        pixels.height,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PIXELS_HEIGHT_INVALID',
        { min: 1 },
    );
    if (
        width !== resolvedRequest.captureRect.width
        || height !== resolvedRequest.captureRect.height
    ) {
        fail(
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CAPTURE_SIZE_MISMATCH',
            `${width}x${height}:${resolvedRequest.captureRect.width}x${resolvedRequest.captureRect.height}`,
        );
    }
    const data = requirePixelBuffer(pixels.data, width * height * 4);

    let minLocalX = width;
    let maxLocalX = -1;
    let minLocalY = height;
    let maxLocalY = -1;
    let alphaPixelCount = 0;
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = data[((y * width) + x) * 4 + 3];
            if (alpha < resolvedRequest.minimumAlpha) {
                continue;
            }
            alphaPixelCount += 1;
            minLocalX = Math.min(minLocalX, x);
            maxLocalX = Math.max(maxLocalX, x);
            minLocalY = Math.min(minLocalY, y);
            maxLocalY = Math.max(maxLocalY, y);
        }
    }

    const observedAlphaBounds = alphaPixelCount > 0
        ? Object.freeze({
            minX: resolvedRequest.captureRect.x + minLocalX,
            maxX: resolvedRequest.captureRect.x + maxLocalX + 1,
            minY: resolvedRequest.captureRect.y + minLocalY,
            maxY: resolvedRequest.captureRect.y + maxLocalY + 1,
            width: maxLocalX - minLocalX + 1,
            height: maxLocalY - minLocalY + 1,
        })
        : null;
    const status = observedAlphaBounds
        ? ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_STATUS.OBSERVED
        : ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_STATUS.EMPTY;
    const observation = {
        contract: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CONTRACT,
        requestContract: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT,
        mode: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE,
        scope: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE,
        purpose: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE,
        requestId: resolvedRequest.requestId,
        identity: resolvedRequest.identity,
        identityKey: resolvedRequest.identityKey,
        sample: Object.freeze({
            frameSequence: resolvedFrameSequence,
            frameCount: resolvedFrameCount,
        }),
        safeViewportRect: resolvedRequest.safeViewportRect,
        capture: Object.freeze({
            rect: resolvedRequest.captureRect,
            minimumAlpha: resolvedRequest.minimumAlpha,
            scannedPixelCount: width * height,
            alphaPixelCount,
        }),
        status,
        observedAlphaBounds,
        overflowPx: resolveOverflow(observedAlphaBounds, resolvedRequest.safeViewportRect),
        censoredEdges: resolveCensoredEdges(observedAlphaBounds, resolvedRequest.captureRect),
    };
    return requireSakuraActualAlphaObservationV1(observation);
}

export function requireSakuraActualAlphaObservationV1(value) {
    requireExactKeys(
        value,
        OBSERVATION_KEYS,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SHAPE_INVALID',
    );
    if (value.contract !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CONTRACT) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CONTRACT_INVALID');
    }
    if (value.requestContract !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT_INVALID');
    }
    if (value.mode !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE_INVALID');
    }
    if (value.scope !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE_INVALID');
    }
    if (value.purpose !== ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE_INVALID');
    }
    const requestId = requireNonEmptyString(
        value.requestId,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_ID_REQUIRED',
    );
    const identity = freezeIdentity(value.identity);
    const identityKey = resolveSakuraActualAlphaObservationIdentityKeyV1(identity);
    if (value.identityKey !== identityKey) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_IDENTITY_KEY_MISMATCH');
    }
    requireExactKeys(
        value.sample,
        SAMPLE_KEYS,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SAMPLE_SHAPE_INVALID',
    );
    const sample = Object.freeze({
        frameSequence: requireInteger(
            value.sample.frameSequence,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_FRAME_SEQUENCE_INVALID',
            { min: 0 },
        ),
        frameCount: requireFiniteNumber(
            value.sample.frameCount,
            'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_FRAME_COUNT_INVALID',
            { min: 0 },
        ),
    });
    const safeViewportRect = freezeRect(
        value.safeViewportRect,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SAFE_VIEWPORT',
    );
    requireExactKeys(
        value.capture,
        CAPTURE_KEYS,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CAPTURE_RESULT_SHAPE_INVALID',
    );
    const captureRect = freezeRect(
        value.capture.rect,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CAPTURE',
    );
    requireViewportCaptureRelation({ identity, safeViewportRect, captureRect });
    const minimumAlpha = requireInteger(
        value.capture.minimumAlpha,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MINIMUM_ALPHA_INVALID',
        { min: 1 },
    );
    if (minimumAlpha > 255) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MINIMUM_ALPHA_INVALID', String(minimumAlpha));
    }
    const scannedPixelCount = requireInteger(
        value.capture.scannedPixelCount,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCANNED_PIXEL_COUNT_INVALID',
        { min: 1 },
    );
    if (scannedPixelCount !== captureRect.width * captureRect.height) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCANNED_PIXEL_COUNT_MISMATCH');
    }
    const alphaPixelCount = requireInteger(
        value.capture.alphaPixelCount,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_ALPHA_PIXEL_COUNT_INVALID',
        { min: 0 },
    );
    if (alphaPixelCount > scannedPixelCount) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_ALPHA_PIXEL_COUNT_INVALID');
    }
    const capture = Object.freeze({
        rect: captureRect,
        minimumAlpha,
        scannedPixelCount,
        alphaPixelCount,
    });
    const allowedStatuses = new Set(Object.values(ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_STATUS));
    if (!allowedStatuses.has(value.status)) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_STATUS_INVALID', String(value.status));
    }
    const observedAlphaBounds = value.observedAlphaBounds === null
        ? null
        : freezeBounds(value.observedAlphaBounds);
    if (
        value.status === ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_STATUS.OBSERVED
        && (!observedAlphaBounds || alphaPixelCount < 1)
    ) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_OBSERVED_RESULT_EMPTY');
    }
    if (
        value.status === ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_STATUS.EMPTY
        && (observedAlphaBounds !== null || alphaPixelCount !== 0)
    ) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_EMPTY_RESULT_NONEMPTY');
    }
    if (
        observedAlphaBounds
        && alphaPixelCount > observedAlphaBounds.width * observedAlphaBounds.height
    ) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_ALPHA_COUNT_EXCEEDS_BOUNDS');
    }
    if (observedAlphaBounds && !containsRect(captureRect, {
        x: observedAlphaBounds.minX,
        y: observedAlphaBounds.minY,
        width: observedAlphaBounds.width,
        height: observedAlphaBounds.height,
    })) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_BOUNDS_OUTSIDE_CAPTURE');
    }
    const overflowPx = freezeEdgeRecord(
        value.overflowPx,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_OVERFLOW',
        (entry, code) => requireInteger(entry, code, { min: 0 }),
    );
    const censoredEdges = freezeEdgeRecord(
        value.censoredEdges,
        'ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CENSORED',
        requireBoolean,
    );
    const expectedOverflow = resolveOverflow(observedAlphaBounds, safeViewportRect);
    const expectedCensoring = resolveCensoredEdges(observedAlphaBounds, captureRect);
    EDGE_KEYS.forEach((edge) => {
        if (overflowPx[edge] !== expectedOverflow[edge]) {
            fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_OVERFLOW_MISMATCH', edge);
        }
        if (censoredEdges[edge] !== expectedCensoring[edge]) {
            fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CENSORING_MISMATCH', edge);
        }
    });
    return Object.freeze({
        contract: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_CONTRACT,
        requestContract: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CONTRACT,
        mode: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_MODE,
        scope: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_SCOPE,
        purpose: ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_PURPOSE,
        requestId,
        identity,
        identityKey,
        sample,
        safeViewportRect,
        capture,
        status: value.status,
        observedAlphaBounds,
        overflowPx,
        censoredEdges,
    });
}

export function assertSakuraActualAlphaObservationMatchesRequestV1({
    request,
    observation,
} = {}) {
    const resolvedRequest = requireSakuraActualAlphaObservationRequestV1(request);
    const resolvedObservation = requireSakuraActualAlphaObservationV1(observation);
    if (resolvedObservation.requestId !== resolvedRequest.requestId) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_ID_MISMATCH');
    }
    if (resolvedObservation.identityKey !== resolvedRequest.identityKey) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_IDENTITY_MISMATCH');
    }
    if (
        JSON.stringify(resolvedObservation.safeViewportRect)
            !== JSON.stringify(resolvedRequest.safeViewportRect)
        || JSON.stringify(resolvedObservation.capture.rect)
            !== JSON.stringify(resolvedRequest.captureRect)
        || resolvedObservation.capture.minimumAlpha !== resolvedRequest.minimumAlpha
    ) {
        fail('ZEN_SAKURA_ACTUAL_ALPHA_OBSERVATION_REQUEST_CAPTURE_MISMATCH');
    }
    return resolvedObservation;
}
