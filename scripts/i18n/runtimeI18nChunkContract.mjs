// Build artifact ownership only. Product code keeps its existing narrow imports.
export const RUNTIME_I18N_PRIMITIVES_CHUNK_NAME = 'runtime-i18n-primitives';

export const RUNTIME_I18N_PRIMITIVE_MODULES = Object.freeze([
  'src/i18n/metadata.js',
  'src/domains/settings/i18n/constants.js',
  'src/domains/settings/i18n/language.js',
  'src/domains/settings/i18n/resourceTranslator.js',
]);

export function resolveRuntimeI18nManualChunk(id) {
  if (typeof id !== 'string') throw new TypeError('RUNTIME_I18N_CHUNK_MODULE_ID_REQUIRED');
  const moduleId = id.replaceAll('\\', '/').split('?')[0];
  return RUNTIME_I18N_PRIMITIVE_MODULES.some(sourceId => (
    moduleId === sourceId || moduleId.endsWith(`/${sourceId}`)
  )) ? RUNTIME_I18N_PRIMITIVES_CHUNK_NAME : null;
}
