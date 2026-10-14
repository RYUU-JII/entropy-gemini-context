export const ZEN_TEMPORAL_AUTHORITY_VERSION = 1;

export const ZEN_TEMPORAL_AUTHORITY_MODES = Object.freeze({
    REALTIME: 'realtime',
    FIXED: 'fixed',
});

const requireFiniteEpochMs = (value) => {
    const epochMs = Number(value);
    if (!Number.isFinite(epochMs)) {
        throw new Error('ZEN_TEMPORAL_AUTHORITY_FIXED_EPOCH_INVALID');
    }
    return Math.floor(epochMs);
};

export const buildZenTemporalAuthority = ({
    mode = ZEN_TEMPORAL_AUTHORITY_MODES.REALTIME,
    fixedEpochMs = null,
} = {}) => {
    if (
        mode !== ZEN_TEMPORAL_AUTHORITY_MODES.REALTIME
        && mode !== ZEN_TEMPORAL_AUTHORITY_MODES.FIXED
    ) {
        throw new Error(`ZEN_TEMPORAL_AUTHORITY_MODE_INVALID:${String(mode)}`);
    }
    const resolvedFixedEpochMs = mode === ZEN_TEMPORAL_AUTHORITY_MODES.FIXED
        ? requireFiniteEpochMs(fixedEpochMs)
        : null;
    return Object.freeze({
        version: ZEN_TEMPORAL_AUTHORITY_VERSION,
        themeId: 'zen',
        mode,
        fixedEpochMs: resolvedFixedEpochMs,
        signature: mode === ZEN_TEMPORAL_AUTHORITY_MODES.REALTIME
            ? `zen_temporal_v${ZEN_TEMPORAL_AUTHORITY_VERSION}:realtime`
            : `zen_temporal_v${ZEN_TEMPORAL_AUTHORITY_VERSION}:fixed:${resolvedFixedEpochMs}`,
    });
};

export const ZEN_REALTIME_TEMPORAL_AUTHORITY = buildZenTemporalAuthority();

export const requireZenTemporalAuthority = (authority) => {
    if (
        !authority
        || typeof authority !== 'object'
        || Array.isArray(authority)
        || authority.version !== ZEN_TEMPORAL_AUTHORITY_VERSION
        || authority.themeId !== 'zen'
    ) {
        throw new Error('ZEN_TEMPORAL_AUTHORITY_REQUIRED');
    }
    if (authority.mode === ZEN_TEMPORAL_AUTHORITY_MODES.REALTIME) {
        if (authority.fixedEpochMs !== null) {
            throw new Error('ZEN_TEMPORAL_AUTHORITY_REALTIME_FIXED_EPOCH_FORBIDDEN');
        }
    } else if (authority.mode === ZEN_TEMPORAL_AUTHORITY_MODES.FIXED) {
        requireFiniteEpochMs(authority.fixedEpochMs);
    } else {
        throw new Error(`ZEN_TEMPORAL_AUTHORITY_MODE_INVALID:${String(authority.mode)}`);
    }
    if (typeof authority.signature !== 'string' || !authority.signature) {
        throw new Error('ZEN_TEMPORAL_AUTHORITY_SIGNATURE_REQUIRED');
    }
    const canonical = buildZenTemporalAuthority({
        mode: authority.mode,
        fixedEpochMs: authority.fixedEpochMs,
    });
    if (authority.signature !== canonical.signature) {
        throw new Error('ZEN_TEMPORAL_AUTHORITY_SIGNATURE_INVALID');
    }
    return authority;
};

export const isZenTemporalAuthorityRealtime = (authority) => (
    requireZenTemporalAuthority(authority).mode === ZEN_TEMPORAL_AUTHORITY_MODES.REALTIME
);
