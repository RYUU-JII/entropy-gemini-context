import { PREPAINT_VISUAL_STYLES } from '../../src/domains/protection/content/prepaintVisualAssets.js';

export function createPrepaintVisualAssetsPlugin() {
  return {
    name: 'entropy-prepaint-visual-assets',
    generateBundle() {
      for (const { path, source } of PREPAINT_VISUAL_STYLES) {
        this.emitFile({ type: 'asset', fileName: path, source });
      }
    },
  };
}
