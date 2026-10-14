export const resolvePixiBonsaiBranchNodeKey = (node = null) => {
    const nodeId = typeof node?.nodeId === 'string' ? node.nodeId.trim() : '';
    if (!nodeId) {
        throw new Error('ZEN_BONSAI_PIXI_BRANCH_NODE_ID_MISSING');
    }
    return nodeId;
};

export const registerPixiBonsaiBranchRecord = ({
    recordByNodeKey,
    node,
    record,
} = {}) => {
    if (!(recordByNodeKey instanceof Map)) {
        throw new Error('ZEN_BONSAI_PIXI_BRANCH_RECORD_INDEX_MISSING');
    }
    const nodeKey = resolvePixiBonsaiBranchNodeKey(node);
    if (recordByNodeKey.has(nodeKey)) {
        throw new Error(`ZEN_BONSAI_PIXI_BRANCH_NODE_ID_DUPLICATE:${nodeKey}`);
    }
    recordByNodeKey.set(nodeKey, record);
    return nodeKey;
};

export const findPixiBonsaiBranchRecord = ({
    recordByNodeKey,
    node,
} = {}) => {
    if (!(recordByNodeKey instanceof Map)) {
        throw new Error('ZEN_BONSAI_PIXI_BRANCH_RECORD_INDEX_MISSING');
    }
    return recordByNodeKey.get(resolvePixiBonsaiBranchNodeKey(node)) || null;
};
