// Physical routing needs only message identities. Descriptor validation and
// material/frame ownership stay in the lazily admitted artifact runtime.
export const ZEN_ARTIFACT_MESSAGE = Object.freeze({ INIT: 'artifact_init', PREPARE: 'artifact_prepare', DRAW: 'artifact_draw',
  MATERIALS: 'artifact_materials', MATERIALS_ERROR: 'artifact_materials_error', MATERIALS_REQUEST: 'artifact_materials_request',
  RESULT: 'artifact_result', ERROR: 'artifact_error', DISPOSE: 'artifact_dispose',
  // Raked-sand ground: one static frame per request, independent of the artifact engine.
  GROUND: 'artifact_ground' });
