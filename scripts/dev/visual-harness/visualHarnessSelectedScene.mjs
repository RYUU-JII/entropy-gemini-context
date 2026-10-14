import { getVisualSceneSource } from '../../../src/apps/visual-harness/sceneCatalog.js';
import { createVisualSceneContractError, VISUAL_CAPTURE_TARGETS } from '../../../src/apps/visual-harness/visualSceneContract.js';

export const VISUAL_HARNESS_SELECTED_SCENE_PATH = '/src/apps/visual-harness/selectedSceneEntry.js';
const RESOLVED_ENTRY_PREFIX = '\0entropy:visual-selected-scene:';
const HARNESS_SOURCE_PATH = '/src/apps/visual-harness/';
const COMMON_ENTRY = 'src/apps/visual-harness/main.jsx';

export function createVisualHarnessSelectedScenes(sceneIds) {
  if (!Array.isArray(sceneIds) || sceneIds.length === 0) {
    throw createVisualSceneContractError('[VisualHarness] selected scene ids are required.');
  }
  const sources = new Map(sceneIds.map((sceneId) => {
    const source = getVisualSceneSource(sceneId);
    return [source.manifest.id, source];
  }));

  function requireSelectedSource(sceneId) {
    const source = getVisualSceneSource(sceneId);
    if (!sources.has(source.manifest.id)) {
      const error = new Error(`[VisualHarness] scene '${source.manifest.id}' was not admitted by this run.`);
      error.code = 'VISUAL_SCENE_NOT_ADMITTED';
      throw error;
    }
    return sources.get(source.manifest.id);
  }

  function entryPathForScene(sceneId) {
    const source = requireSelectedSource(sceneId);
    return `${VISUAL_HARNESS_SELECTED_SCENE_PATH}?scene=${encodeURIComponent(source.manifest.id)}`;
  }

  const optimizeEntries = [COMMON_ENTRY, ...new Set([...sources.values()].map(
    (source) => `${HARNESS_SOURCE_PATH.slice(1)}${source.sourceModule.slice(2)}`,
  ))];

  const plugin = {
    name: 'entropy:visual-selected-scene',
    resolveId(id) {
      if (!id.startsWith(`${VISUAL_HARNESS_SELECTED_SCENE_PATH}?`)) return null;
      const url = new URL(id, 'http://127.0.0.1');
      const source = requireSelectedSource(url.searchParams.get('scene'));
      return `${RESOLVED_ENTRY_PREFIX}${source.manifest.id}`;
    },
    load(id) {
      if (!id.startsWith(RESOLVED_ENTRY_PREFIX)) return null;
      const source = requireSelectedSource(id.slice(RESOLVED_ENTRY_PREFIX.length));
      const entry = {
        ...source.manifest,
        // Normalized manifests carry selector:'' for viewport captures; catalog
        // declarations must omit that selector before browser revalidation.
        captures: source.manifest.captures.map(({ name, target, selector }) => (
          target === VISUAL_CAPTURE_TARGETS.viewport ? { name, target } : { name, target, selector }
        )),
        sourceModule: source.sourceModule,
        sourceExport: source.sourceExport,
      };
      const sceneModulePath = `${HARNESS_SOURCE_PATH}${source.sourceModule.slice(2)}`;
      return `import { bootVisualHarness } from ${JSON.stringify(`/${COMMON_ENTRY}`)};
import { assembleVisualScene, createVisualSceneContractError, defineVisualSceneCatalogEntry } from ${JSON.stringify(`${HARNESS_SOURCE_PATH}visualSceneContract.js`)};
const entry = defineVisualSceneCatalogEntry(${JSON.stringify(entry)});
void bootVisualHarness(async (sceneId) => {
  if (sceneId !== entry.id) {
    throw createVisualSceneContractError('[VisualHarness] selected source entry does not match the requested scene.', { sceneId, selectedSceneId: entry.id });
  }
  const sceneModule = await import(${JSON.stringify(sceneModulePath)});
  return assembleVisualScene(entry, sceneModule[entry.sourceExport]);
});
`;
    },
  };

  return { entryPathForScene, optimizeEntries, plugin, sceneIds: [...sources.keys()] };
}
