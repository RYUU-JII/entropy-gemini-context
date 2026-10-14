import {
    SAKURA_BRANCH_ORDER,
} from '../../model/bonsai/generation/shapePriorModel.js';

export const PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY = Object.freeze({
    subtreeBakeMinDepth: 4,
    softFanMinDepth: 3,
    softFanMaxWidth: 2.6,
    softFanMinOrder: SAKURA_BRANCH_ORDER.SECONDARY_BRANCH,
    largeFanMaxLiveDepth: 3,
    largeFanMinVisualMass: 34,
    largeFanMinChildBranches: 2,
    largeFanMinTerminals: 4,
    subtreeSummaryMaxBranches: 28,
    subtreeSummaryMaxDepthFromRoot: 3,
    terminalHingeMaxLiveDepth: 5,
    terminalHingeMinChildBranches: 2,
    terminalHingeMinSubtreeBranches: 3,
    terminalHingeMinTerminals: 4,
    terminalHingeMinVisualMass: 18,
});

const toNumber = (value, fallback = 0) => (
    Number.isFinite(Number(value)) ? Number(value) : fallback
);

export const summarizePixiBonsaiBranchWidthProfile = (renderNode = {}) => {
    const profile = renderNode?.widthProfile;
    if (!profile || typeof profile !== 'object') {
        return Object.freeze({
            present: false,
            profile: 'none',
            baseWidth: 0,
            tipWidth: 0,
            taperRatio: 1,
        });
    }
    const baseWidth = Math.max(0.01, toNumber(profile.baseWidth, renderNode?.width || 0.01));
    const tipWidth = Math.max(0.01, toNumber(profile.tipWidth, baseWidth));
    return Object.freeze({
        present: true,
        profile: typeof profile.profile === 'string' ? profile.profile : 'unknown',
        baseWidth: Number(baseWidth.toFixed(4)),
        tipWidth: Number(tipWidth.toFixed(4)),
        taperRatio: Number((tipWidth / Math.max(0.01, baseWidth)).toFixed(4)),
    });
};

export const resolvePixiBonsaiRenderPlanSubtreeSummary = ({
    record = null,
} = {}) => {
    if (!record || record.node?.type !== 'branch') {
        throw new Error('ZEN_BONSAI_PIXI_RENDER_PLAN_RECORD_REQUIRED');
    }
    const resolvedDepth = Math.max(1, Math.round(Number(record.depth) || 1));
    const summary = {
        branchCount: 0,
        childBranchCount: record.children.length,
        terminalCount: 0,
        maxDepth: resolvedDepth,
        maxWidth: 0,
        maxLength: 0,
        visualMass: 0,
        truncated: false,
    };
    const maxBranches = PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.subtreeSummaryMaxBranches;
    const maxDepthFromRoot = PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.subtreeSummaryMaxDepthFromRoot;
    const walk = (current) => {
        if (summary.branchCount >= maxBranches) {
            summary.truncated = true;
            return;
        }
        const node = current.node;
        const length = Math.max(0, toNumber(node?.length, 0));
        const width = Math.max(0, toNumber(node?.width, 0));
        summary.branchCount += 1;
        summary.terminalCount += current.terminals.length;
        summary.maxDepth = Math.max(summary.maxDepth, current.depth);
        summary.maxWidth = Math.max(summary.maxWidth, width);
        summary.maxLength = Math.max(summary.maxLength, length);
        summary.visualMass += length * Math.max(0.22, width);
        if ((current.depth - resolvedDepth) >= maxDepthFromRoot) return;
        current.children.forEach((link) => walk(link.child));
    };
    walk(record);
    return summary;
};

export const shouldBakePixiBonsaiRenderPlanSubtree = (record = null) => {
    if (!record || record.node?.type !== 'branch') {
        throw new Error('ZEN_BONSAI_PIXI_RENDER_PLAN_RECORD_REQUIRED');
    }
    const order = Number(record.node.branchOrder);
    const width = Math.max(0, Number(record.node.width) || 0);
    const depth = Math.max(1, Math.round(Number(record.depth) || 1));
    const summary = resolvePixiBonsaiRenderPlanSubtreeSummary({ record });
    if (order >= SAKURA_BRANCH_ORDER.TERMINAL_TWIG) {
        const keepTerminalHingeLive = (
            depth <= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.terminalHingeMaxLiveDepth
            && summary.childBranchCount
                >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.terminalHingeMinChildBranches
            && summary.branchCount
                >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.terminalHingeMinSubtreeBranches
            && (
                summary.terminalCount
                    >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.terminalHingeMinTerminals
                || summary.visualMass
                    >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.terminalHingeMinVisualMass
            )
        );
        return !keepTerminalHingeLive;
    }
    if (order < PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.softFanMinOrder) return false;
    if (depth >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.subtreeBakeMinDepth) return true;
    const keepLargeSoftFanLive = (
        depth <= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.largeFanMaxLiveDepth
        && summary.childBranchCount
            >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.largeFanMinChildBranches
        && summary.terminalCount
            >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.largeFanMinTerminals
        && summary.visualMass
            >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.largeFanMinVisualMass
    );
    return (
        depth >= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.softFanMinDepth
        && width > 0
        && width <= PIXI_BONSAI_BRANCH_RIG_MOTION_POLICY.softFanMaxWidth
        && !keepLargeSoftFanLive
    );
};

export const collectPixiBonsaiRenderPlanChildren = (record = null) => {
    if (!record || record.node?.type !== 'branch' || !Array.isArray(record.children)) {
        throw new Error('ZEN_BONSAI_PIXI_RENDER_PLAN_RECORD_REQUIRED');
    }
    return record.children;
};

export const collectPixiBonsaiRenderPlanRigStats = ({
    record = null,
} = {}) => {
    if (!record || record.node?.type !== 'branch') {
        throw new Error('ZEN_BONSAI_PIXI_RENDER_PLAN_RECORD_REQUIRED');
    }
    const stats = {
        visibleBranches: 0,
        rigRecords: 0,
        groupedSubtreeRecords: 0,
    };

    const walk = (current, insideGroupedSubtree = false) => {
        stats.visibleBranches += 1;
        const subtreeBaked = shouldBakePixiBonsaiRenderPlanSubtree(current);
        const nextInsideGroupedSubtree = insideGroupedSubtree || subtreeBaked;
        if (!insideGroupedSubtree) {
            stats.rigRecords += 1;
            if (subtreeBaked) {
                stats.groupedSubtreeRecords += 1;
            }
        }
        collectPixiBonsaiRenderPlanChildren(current).forEach((link) => (
            walk(link.child, nextInsideGroupedSubtree)
        ));
    };

    walk(record, false);
    return stats;
};
