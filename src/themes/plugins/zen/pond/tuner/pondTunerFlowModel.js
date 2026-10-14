const POND_TUNER_LAYOUT_MODES = Object.freeze({
    TARGETS: 'targets',
    POND_FLOW: 'pond_flow',
    POND_INSPECTOR: 'pond_inspector',
});

// The lab owns the navigation. This projection reuses the canonical parameter
// registry without embedding another target/mode/stage navigation inside it.
export const POND_INSPECTOR_SECTIONS = Object.freeze({
    scene: { primary: ['environment', 'ecosystem'], detail: [] },
    water: { primary: ['waterTone'], detail: ['waterReflection'] },
    koi: { primary: ['koiModel', 'koiFeel', 'koiLook'], detail: ['koiSwim', 'koiBody', 'koiAppendages', 'koiRig', 'koiHybrid'] },
    inspect: { primary: ['channels', 'koiDiagnostics'], detail: [] },
});

export const resolvePondInspectorGroups = ({ groups, section, activeSwimModel }) => {
    const definition = POND_INSPECTOR_SECTIONS[section];
    if (!definition) throw new Error(`ZEN_POND_INSPECTOR_SECTION_INVALID:${section}`);
    const resolve = ids => ids.map(id => {
        const group = groups.find(entry => entry.id === id);
        if (!group) throw new Error(`ZEN_POND_INSPECTOR_GROUP_MISSING:${id}`);
        return group;
    }).filter(group => !group.appliesTo || group.appliesTo.includes(activeSwimModel));
    return { primary: resolve(definition.primary), detail: resolve(definition.detail) };
};

const POND_TUNER_FLOW_STAGES = Object.freeze([
    Object.freeze({
        id: 'environment',
        badge: 'cause',
        groupIds: Object.freeze(['environment', 'waterTone', 'ecosystem']),
    }),
    Object.freeze({
        id: 'surface',
        badge: 'operational',
        groupIds: Object.freeze(['waterReflection']),
    }),
    Object.freeze({
        id: 'koi',
        badge: 'creature',
        groupIds: Object.freeze([
            'koiModel',
            'koiFeel',
            'koiLook',
            'koiBody',
            'koiSwim',
            'koiAppendages',
            'koiRig',
            'koiHybrid',
        ]),
    }),
    Object.freeze({
        id: 'inspect',
        badge: 'advanced',
        groupIds: Object.freeze(['channels', 'koiDiagnostics']),
    }),
]);

const DEFAULT_POND_TUNER_FLOW_STAGE_ID = POND_TUNER_FLOW_STAGES[0].id;

const FLOW_STAGE_BY_ID = new Map(
    POND_TUNER_FLOW_STAGES.map((stage) => [stage.id, stage]),
);

const resolvePondTunerFlowStage = (stageId) => (
    FLOW_STAGE_BY_ID.get(stageId) || FLOW_STAGE_BY_ID.get(DEFAULT_POND_TUNER_FLOW_STAGE_ID)
);

const resolvePondTunerFlowGroups = ({
    groups = [],
    stageId = DEFAULT_POND_TUNER_FLOW_STAGE_ID,
    activeSwimModel = '',
} = {}) => {
    const stage = resolvePondTunerFlowStage(stageId);
    const groupById = new Map(
        (Array.isArray(groups) ? groups : []).map((group) => [group.id, group]),
    );
    return stage.groupIds
        .map((groupId) => groupById.get(groupId))
        .filter(Boolean)
        .filter((group) => {
            if (!Array.isArray(group.appliesTo)) return true;
            return group.appliesTo.includes(activeSwimModel);
        });
};

export {
    POND_TUNER_LAYOUT_MODES,
    POND_TUNER_FLOW_STAGES,
    DEFAULT_POND_TUNER_FLOW_STAGE_ID,
    resolvePondTunerFlowStage,
    resolvePondTunerFlowGroups,
};
