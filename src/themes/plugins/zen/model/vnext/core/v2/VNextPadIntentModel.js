import {
    clamp01,
    round,
    toNumber,
} from './VNextGrowthMath';

const fit01 = (value = 0, fallback = 0.5) => clamp01(toNumber(value, fallback));

const normalizeHeight = (site = {}, bounds = {}) => (
    fit01(
        Number.isFinite(Number(site?.heightNorm))
            ? Number(site.heightNorm)
            : (toNumber(site?.position?.[1], 0) / Math.max(1, toNumber(bounds?.height, 420))),
    )
);

const normalizeReach = (site = {}, bounds = {}) => (
    fit01(
        Number.isFinite(Number(site?.reachNorm))
            ? Number(site.reachNorm)
            : (Math.abs(toNumber(site?.position?.[0], 0)) / Math.max(24, toNumber(bounds?.width, 420) * 0.34)),
    )
);

const resolveSideSign = (site = {}) => {
    const direct = Math.sign(toNumber(site?.sideSign, 0));
    if (direct !== 0) {
        return direct;
    }
    const lateral = Math.sign(toNumber(site?.position?.[0], 0));
    return lateral === 0 ? 1 : lateral;
};

const PAD_ROLE_TEMPLATES = Object.freeze({
    first_branch: {
        profile: 'sweep_pad',
        primaryAction: 'sweep',
        compactness: 0.34,
        reachBias: 0.86,
        sweepBias: 0.92,
        recoveryBias: 0.42,
        branchingBias: 0.52,
        terminalDensity: 0.58,
        droopBias: 0.38,
        voidRespect: 0.64,
        targetDepthBias: 0.66,
    },
    counter_branch: {
        profile: 'counter_pad',
        primaryAction: 'sweep',
        compactness: 0.42,
        reachBias: 0.72,
        sweepBias: 0.8,
        recoveryBias: 0.5,
        branchingBias: 0.5,
        terminalDensity: 0.56,
        droopBias: 0.34,
        voidRespect: 0.62,
        targetDepthBias: 0.62,
    },
    apex_feeder: {
        profile: 'apex_pad',
        primaryAction: 'settle',
        compactness: 0.68,
        reachBias: 0.34,
        sweepBias: 0.24,
        recoveryBias: 0.86,
        branchingBias: 0.52,
        terminalDensity: 0.72,
        droopBias: 0.18,
        voidRespect: 0.58,
        targetDepthBias: 0.56,
    },
    mid_support: {
        profile: 'support_pad',
        primaryAction: 'extend',
        compactness: 0.58,
        reachBias: 0.42,
        sweepBias: 0.34,
        recoveryBias: 0.72,
        branchingBias: 0.58,
        terminalDensity: 0.54,
        droopBias: 0.28,
        voidRespect: 0.7,
        targetDepthBias: 0.64,
    },
    inner_balance: {
        profile: 'inner_pad',
        primaryAction: 'settle',
        compactness: 0.72,
        reachBias: 0.24,
        sweepBias: 0.18,
        recoveryBias: 0.82,
        branchingBias: 0.48,
        terminalDensity: 0.48,
        droopBias: 0.2,
        voidRespect: 0.76,
        targetDepthBias: 0.48,
    },
    upper_balance: {
        profile: 'upper_pad',
        primaryAction: 'settle',
        compactness: 0.6,
        reachBias: 0.32,
        sweepBias: 0.24,
        recoveryBias: 0.8,
        branchingBias: 0.54,
        terminalDensity: 0.66,
        droopBias: 0.24,
        voidRespect: 0.64,
        targetDepthBias: 0.54,
    },
    outer_fill: {
        profile: 'flower_pad',
        primaryAction: 'sweep',
        compactness: 0.38,
        reachBias: 0.78,
        sweepBias: 0.76,
        recoveryBias: 0.46,
        branchingBias: 0.62,
        terminalDensity: 0.82,
        droopBias: 0.52,
        voidRespect: 0.58,
        targetDepthBias: 0.62,
    },
    upper_fill: {
        profile: 'flower_pad',
        primaryAction: 'settle',
        compactness: 0.48,
        reachBias: 0.46,
        sweepBias: 0.34,
        recoveryBias: 0.74,
        branchingBias: 0.66,
        terminalDensity: 0.86,
        droopBias: 0.42,
        voidRespect: 0.6,
        targetDepthBias: 0.56,
    },
    inner_fill: {
        profile: 'inner_pad',
        primaryAction: 'extend',
        compactness: 0.64,
        reachBias: 0.28,
        sweepBias: 0.24,
        recoveryBias: 0.72,
        branchingBias: 0.56,
        terminalDensity: 0.52,
        droopBias: 0.26,
        voidRespect: 0.74,
        targetDepthBias: 0.52,
    },
    branch: {
        profile: 'support_pad',
        primaryAction: 'extend',
        compactness: 0.52,
        reachBias: 0.5,
        sweepBias: 0.42,
        recoveryBias: 0.58,
        branchingBias: 0.54,
        terminalDensity: 0.56,
        droopBias: 0.3,
        voidRespect: 0.64,
        targetDepthBias: 0.58,
    },
});

const resolveCompactnessClass = (value = 0.5) => {
    if (value >= 0.68) {
        return 'compact';
    }
    if (value <= 0.38) {
        return 'open';
    }
    return 'balanced';
};

const resolveTerminalMode = ({
    terminalDensity = 0.5,
    compactness = 0.5,
    roleBase = 'branch',
} = {}) => {
    if (roleBase === 'apex_feeder' || roleBase === 'upper_fill' || roleBase === 'outer_fill') {
        return terminalDensity >= 0.56 ? 'cluster' : 'mixed';
    }
    if (compactness >= 0.68 && terminalDensity <= 0.64) {
        return 'spur';
    }
    if (terminalDensity >= 0.72) {
        return 'cluster';
    }
    return 'mixed';
};

const serializePadIntent = (intent = {}) => ({
    id: intent?.id || 'pad_0',
    siteId: intent?.siteId || 'site',
    roleBase: intent?.roleBase || 'branch',
    profile: intent?.profile || 'support_pad',
    primaryAction: intent?.primaryAction || 'extend',
    terminalMode: intent?.terminalMode || 'mixed',
    compactness: round(fit01(intent?.compactness), 6),
    reachBias: round(fit01(intent?.reachBias), 6),
    sweepBias: round(fit01(intent?.sweepBias), 6),
    recoveryBias: round(fit01(intent?.recoveryBias), 6),
    branchingBias: round(fit01(intent?.branchingBias), 6),
    terminalDensity: round(fit01(intent?.terminalDensity), 6),
    droopBias: round(fit01(intent?.droopBias), 6),
    voidRespect: round(fit01(intent?.voidRespect), 6),
    targetDepthBias: round(fit01(intent?.targetDepthBias), 6),
});

const averageIntentValue = (intents = [], key = 'compactness') => {
    if (!Array.isArray(intents) || !intents.length) {
        return 0;
    }
    return intents.reduce((acc, entry) => acc + fit01(entry?.[key]), 0) / intents.length;
};

const buildPadIntentForSite = ({
    site = {},
    index = 0,
    runtime = {},
    bounds = {},
} = {}) => {
    const roleBase = site?.roleBase || site?.role || 'branch';
    const template = PAD_ROLE_TEMPLATES[roleBase] || PAD_ROLE_TEMPLATES.branch;
    const lineage = runtime?.lineage || {};
    const budField = runtime?.budField || {};
    const sakura = runtime?.sakura || {};
    const backbone = runtime?.backbone || {};
    const padRuntime = runtime?.pad || {};
    const heightNorm = normalizeHeight(site, bounds);
    const reachNorm = normalizeReach(site, bounds);
    const sideSign = resolveSideSign(site);
    const compactness = clamp01(
        (template.compactness * 0.44)
        + (fit01(padRuntime?.compactness, 0.5) * 0.2)
        + (fit01(lineage?.branchDensity, 0.5) * 0.18)
        + ((1 - fit01(budField?.crownOpenness, 0.5)) * 0.12)
        + (fit01(lineage?.recoveryBias, 0.5) * 0.08)
        + ((1 - reachNorm) * 0.1)
        + ((roleBase === 'inner_balance' || roleBase === 'inner_fill') ? 0.08 : 0),
    );
    const reachBias = clamp01(
        (template.reachBias * 0.46)
        + (reachNorm * 0.18)
        + ((1 - compactness) * 0.16)
        + (fit01(padRuntime?.sweepBias, 0.5) * 0.08)
        + (fit01(lineage?.sweepPersistence, 0.5) * 0.1)
        + ((roleBase === 'first_branch' || roleBase === 'outer_fill') ? 0.06 : 0),
    );
    const sweepBias = clamp01(
        (template.sweepBias * 0.44)
        + (fit01(padRuntime?.sweepBias, 0.5) * 0.22)
        + (fit01(lineage?.sweepPersistence, 0.5) * 0.22)
        + (reachBias * 0.12)
        + ((1 - compactness) * 0.12)
        + (fit01(backbone?.curveEnergy, 0.5) * 0.1),
    );
    const recoveryBias = clamp01(
        (template.recoveryBias * 0.48)
        + (fit01(lineage?.recoveryBias, 0.5) * 0.24)
        + (fit01(runtime?.scaffold?.supportBias, 0.5) * 0.1)
        + ((1 - reachNorm) * 0.1)
        + (compactness * 0.08),
    );
    const branchingBias = clamp01(
        (template.branchingBias * 0.44)
        + (fit01(lineage?.splitBias, 0.5) * 0.26)
        + (fit01(padRuntime?.terminalDensity, 0.5) * 0.06)
        + (fit01(lineage?.branchDensity, 0.5) * 0.12)
        + ((heightNorm > 0.58) ? 0.06 : 0)
        + ((reachNorm > 0.44) ? 0.04 : 0),
    );
    const terminalDensity = clamp01(
        (template.terminalDensity * 0.42)
        + (fit01(padRuntime?.terminalDensity, 0.5) * 0.24)
        + (fit01(lineage?.spurRate, 0.5) * 0.24)
        + (fit01(sakura?.flowerChance, 0.5) * 0.16)
        + (fit01(lineage?.branchDensity, 0.5) * 0.08)
        + ((heightNorm > 0.56) ? 0.04 : 0)
        + ((roleBase === 'outer_fill' || roleBase === 'upper_fill') ? 0.06 : 0),
    );
    const droopBias = clamp01(
        (template.droopBias * 0.42)
        + (fit01(sakura?.droopTendency, 0.2) * 0.28)
        + (reachNorm * 0.12)
        + ((heightNorm > 0.62) ? 0.06 : 0)
        + ((roleBase === 'outer_fill' || roleBase === 'upper_fill') ? 0.08 : 0),
    );
    const voidRespect = clamp01(
        (template.voidRespect * 0.48)
        + (fit01(budField?.negativeSpaceTarget, 0.5) * 0.22)
        + (fit01(backbone?.voidRespect, 0.5) * 0.16)
        + ((1 - compactness) * 0.08)
        + ((reachNorm > 0.46) ? 0.04 : 0),
    );
    const targetDepthBias = clamp01(
        (template.targetDepthBias * 0.48)
        + (fit01(lineage?.branchDensity, 0.5) * 0.14)
        + (fit01(lineage?.splitBias, 0.5) * 0.14)
        + (terminalDensity * 0.08)
        + ((roleBase === 'apex_feeder') ? -0.06 : 0),
    );
    const primaryAction = (() => {
        if (template.primaryAction === 'sweep' && sweepBias >= (recoveryBias - 0.06)) {
            return 'sweep';
        }
        if (template.primaryAction === 'settle' && recoveryBias >= (sweepBias - 0.04)) {
            return 'settle';
        }
        return compactness >= 0.62 ? 'settle' : (reachBias >= 0.56 ? 'sweep' : 'extend');
    })();
    const terminalMode = resolveTerminalMode({
        terminalDensity,
        compactness,
        roleBase,
    });
    return {
        id: `pad_${index}`,
        siteId: site?.id || `site_${index}`,
        roleBase,
        role: site?.role || roleBase,
        profile: template.profile,
        primaryAction,
        terminalMode,
        compactnessClass: resolveCompactnessClass(compactness),
        sideSign,
        heightNorm: round(heightNorm, 6),
        reachNorm: round(reachNorm, 6),
        compactness: round(compactness, 6),
        reachBias: round(reachBias, 6),
        sweepBias: round(sweepBias, 6),
        recoveryBias: round(recoveryBias, 6),
        branchingBias: round(branchingBias, 6),
        terminalDensity: round(terminalDensity, 6),
        droopBias: round(droopBias, 6),
        voidRespect: round(voidRespect, 6),
        targetDepthBias: round(targetDepthBias, 6),
    };
};

export const buildVNextPadIntentPlan = ({
    selectedScaffolds = [],
    runtime = {},
    bounds = {},
} = {}) => {
    const intents = (Array.isArray(selectedScaffolds) ? selectedScaffolds : []).map((site, index) => (
        buildPadIntentForSite({
            site,
            index,
            runtime,
            bounds,
        })
    ));
    return {
        selectedScaffolds: (Array.isArray(selectedScaffolds) ? selectedScaffolds : []).map((site, index) => ({
            ...site,
            padIntent: intents[index] || null,
        })),
        debug: {
            padPlan: intents.map((intent) => serializePadIntent(intent)),
            padAverages: {
                compactness: round(averageIntentValue(intents, 'compactness'), 6),
                sweepBias: round(averageIntentValue(intents, 'sweepBias'), 6),
                recoveryBias: round(averageIntentValue(intents, 'recoveryBias'), 6),
                branchingBias: round(averageIntentValue(intents, 'branchingBias'), 6),
                terminalDensity: round(averageIntentValue(intents, 'terminalDensity'), 6),
            },
        },
    };
};
