export const ZEN_BONSAI_INIT_DIAGNOSTICS_ENABLED = (
    typeof __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__ !== 'undefined'
        ? __ENTROPY_BUILD_INCLUDE_DEBUG_TOOLS__
        : true
);
