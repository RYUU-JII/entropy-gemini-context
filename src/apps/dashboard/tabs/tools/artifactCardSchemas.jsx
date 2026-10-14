import { TOOLS_ARTIFACT_DEFINITIONS } from '@/themes/core/tools/artifacts.js';
import { lensCardSchema } from './artifactCards/schemas/lensCardSchema.js';
import { veilCardSchema } from './artifactCards/schemas/veilCardSchema.js';
import { brakeCardSchema } from './artifactCards/schemas/brakeCardSchema.js';
import { barrierCardSchema } from './artifactCards/schemas/barrierCardSchema.js';
import { gateCardSchema } from './artifactCards/schemas/gateCardSchema.js';
import { flareCardSchema } from './artifactCards/schemas/flareCardSchema.js';
import { echoCardSchema } from './artifactCards/schemas/echoCardSchema.js';

// Collection-only registry. Live controllers import their own schema directly.
const TOOLS_ARTIFACT_CARD_SCHEMA_BUILDERS = Object.freeze({
  lens: lensCardSchema,
  veil: veilCardSchema,
  brake: brakeCardSchema,
  barrier: barrierCardSchema,
  gate: gateCardSchema,
  flare: flareCardSchema,
  echo: echoCardSchema,
});

function assertToolsArtifactCardSchemaContract() {
  const definitionIds = TOOLS_ARTIFACT_DEFINITIONS.map((definition) => definition.id);
  const builderIds = Object.keys(TOOLS_ARTIFACT_CARD_SCHEMA_BUILDERS);
  if (
    definitionIds.length !== builderIds.length
    || definitionIds.some((artifactId) => !builderIds.includes(artifactId))
  ) {
    throw new Error('[toolsArtifactCardSchemas] Card builders must cover every tools artifact definition exactly once.');
  }

  builderIds.forEach((artifactId) => {
    const schema = TOOLS_ARTIFACT_CARD_SCHEMA_BUILDERS[artifactId];
    if (typeof schema?.build !== 'function') {
      throw new Error(`[toolsArtifactCardSchemas] Missing card builder for "${artifactId}".`);
    }
    if (typeof schema.extendDerivedState !== 'function') {
      throw new Error(`[toolsArtifactCardSchemas] Missing derived-state builder for "${artifactId}".`);
    }
    if (
      Object.prototype.hasOwnProperty.call(schema, 'buildVisualState')
      && typeof schema.buildVisualState !== 'function'
    ) {
      throw new Error(`[toolsArtifactCardSchemas] Invalid visual-state builder for "${artifactId}".`);
    }
  });
}

assertToolsArtifactCardSchemaContract();

export const TOOLS_ARTIFACT_CARD_SCHEMAS = Object.freeze(
  TOOLS_ARTIFACT_DEFINITIONS.map((definition) => Object.freeze({
    id: definition.id,
    ...TOOLS_ARTIFACT_CARD_SCHEMA_BUILDERS[definition.id],
  })),
);

const TOOLS_ARTIFACT_CARD_SCHEMA_MAP = Object.freeze(
  TOOLS_ARTIFACT_CARD_SCHEMAS.reduce((acc, schema) => {
    acc[schema.id] = schema;
    return acc;
  }, {}),
);

export function getToolsArtifactCardSchema(artifactId) {
  return TOOLS_ARTIFACT_CARD_SCHEMA_MAP[artifactId] || null;
}
