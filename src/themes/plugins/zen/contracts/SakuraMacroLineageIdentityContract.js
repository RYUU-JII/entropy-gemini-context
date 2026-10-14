export const SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE = (
    'sakura_macro_spine_shape_v1'
);
export const SAKURA_SCAFFOLD_STATION_LINEAGE_ID_NAMESPACE = (
    'sakura_scaffold_station_lineage_v1'
);
export const SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS = 7;
export const SAKURA_MACRO_LINEAGE_IDENTITY_QUANTUM = (
    10 ** -SAKURA_MACRO_LINEAGE_IDENTITY_DECIMALS
);

const STRUCTURAL_PLAN_HASH_SUFFIX = '[0-9a-f]{8}';

const createNamespacePattern = (namespace) => new RegExp(
    `^${namespace}_${STRUCTURAL_PLAN_HASH_SUFFIX}$`,
);

const MACRO_SPINE_SHAPE_ID_PATTERN = createNamespacePattern(
    SAKURA_MACRO_SPINE_SHAPE_ID_NAMESPACE,
);
const SCAFFOLD_STATION_LINEAGE_ID_PATTERN = createNamespacePattern(
    SAKURA_SCAFFOLD_STATION_LINEAGE_ID_NAMESPACE,
);

export const isSakuraMacroSpineShapeIdV1 = (value) => (
    typeof value === 'string' && MACRO_SPINE_SHAPE_ID_PATTERN.test(value)
);

export const isSakuraScaffoldStationLineageIdV1 = (value) => (
    typeof value === 'string' && SCAFFOLD_STATION_LINEAGE_ID_PATTERN.test(value)
);
