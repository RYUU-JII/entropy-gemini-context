import { buildZenKoiRosterSnapshot } from '@/themes/plugins/zen/pond/roster/zenKoiRosterPolicy.js';

const cloneJsonSafe = (value) => {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return null;
    }
};

const normalizeDomain = (value) => (
    typeof value === 'string' ? value.trim().toLowerCase() : null
);

const buildRosterItemSnapshot = (item, index) => ({
    index,
    entityId: item?.entityId || '',
    domain: item?.domain || '',
    slot: item?.slot || '',
    cohort: item?.cohort || '',
    policyStatus: item?.policyStatus || '',
    presenceState: item?.presenceState || '',
    priority: item?.priority ?? null,
    risk: item?.risk ?? null,
    signals: cloneJsonSafe(item?.signals || null),
    expressionProfile: cloneJsonSafe(item?.expressionProfile || null),
    appearanceProfile: cloneJsonSafe(item?.appearanceProfile || null),
    formationProfile: cloneJsonSafe(item?.formationProfile || null),
});

export const buildExperimentPondKoiSnapshot = ({
    dataMode = 'unknown',
    theme = 'unknown',
    domainCandidates = [],
    syntheticSeed = null,
    syntheticActive = false,
    scannerStatus = null,
    dailyDisplayScore = null,
    lockedTarget = null,
    nowMs = Date.now(),
    experimentControls = null,
} = {}) => {
    const generatedAtMs = Number.isFinite(Number(nowMs))
        ? Math.max(0, Math.trunc(Number(nowMs)))
        : Date.now();
    const candidates = Array.isArray(domainCandidates) ? domainCandidates : [];
    const focusDomain = normalizeDomain(lockedTarget);
    const rosterSnapshot = buildZenKoiRosterSnapshot({
        domainCandidates: candidates,
        focusDomain,
        nowMs: generatedAtMs,
    });

    return {
        schemaVersion: 1,
        source: 'experiment.pond_lab.koi_snapshot',
        experimentControls: cloneJsonSafe(experimentControls),
        generatedAt: new Date(generatedAtMs).toISOString(),
        theme,
        pond: {
            dataMode,
            syntheticActive: syntheticActive === true,
            syntheticSeed: syntheticActive === true ? syntheticSeed : null,
            scannerStatus,
            dailyDisplayScore,
            lockedTarget: focusDomain,
        },
        renderScaleContract: {
            expressionScalePath: 'expressionProfile.size.effectiveScale',
            finalRenderSizeFormula: 'fishInfo.baseSize * fishInfo.hoverScale * expressionProfile.size.effectiveScale',
            effectiveScaleClamp: {
                min: 0.96,
                max: 1.18,
            },
            bakedTextureKeyIncludesExpressionScale: false,
            bodyLengthDriver: 'render transform around the simulation spine anchor; history length and physics segment count stay unchanged',
            diagnosticNote: 'Pressure scale is applied at render time to body ropes, appendage positions, and appendage scale without rebaking textures or changing simulation geometry.',
        },
        sourceCandidates: candidates.map((candidate, index) => ({
            index,
            ...cloneJsonSafe(candidate),
        })),
        roster: {
            signature: rosterSnapshot.signature,
            focusDomain: rosterSnapshot.focusDomain,
            capacity: cloneJsonSafe(rosterSnapshot.capacity || null),
            itemCount: Array.isArray(rosterSnapshot.items) ? rosterSnapshot.items.length : 0,
            items: Array.isArray(rosterSnapshot.items)
                ? rosterSnapshot.items.map(buildRosterItemSnapshot)
                : [],
        },
    };
};

export const serializeExperimentPondKoiSnapshot = (snapshot) => (
    JSON.stringify(snapshot, null, 2)
);

export const copyTextToClipboard = async (text) => {
    const payload = typeof text === 'string' ? text : '';
    if (!payload) return false;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(payload);
            return true;
        } catch (_error) {
            // Continue to the document fallback below.
        }
    }

    if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
        return false;
    }

    const textarea = document.createElement('textarea');
    textarea.value = payload;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    let copied = false;
    try {
        copied = document.execCommand('copy');
    } finally {
        document.body.removeChild(textarea);
    }
    return copied;
};
