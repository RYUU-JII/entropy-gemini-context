import '@pixi/unsafe-eval';
import { BatchRenderer, BatchShaderGenerator, ExtensionType, Program, Shader, extensions } from '@pixi/core';
import { TilingSpriteRenderer } from '@pixi/sprite-tiling';
import { createZenPondSpriteBatchRendererClass } from '../../pond/renderers/pixi/zenPondSpriteBatchShader.js';
import { createZenPondTilingSpriteRendererClass } from '../../pond/renderers/pixi/zenPondTilingSpriteShader.js';

// Register through Pixi's public extension seam. Declared Zen Pond, Bonsai and
// artifact hosts opt in; unflagged renderers retain native generation.
const ZenPondSpriteBatchRenderer = createZenPondSpriteBatchRendererClass({ BatchRenderer, BatchShaderGenerator, Program });
ZenPondSpriteBatchRenderer.extension = { name: 'batch', type: ExtensionType.RendererPlugin };
extensions.add(ZenPondSpriteBatchRenderer);

const ZenPondTilingSpriteRenderer = createZenPondTilingSpriteRendererClass({ TilingSpriteRenderer, Shader });
ZenPondTilingSpriteRenderer.extension = { name: 'tilingSprite', type: ExtensionType.RendererPlugin };
extensions.add(ZenPondTilingSpriteRenderer);

export { installZenPixiProgramDiagnostics } from './zenPixiProgramDiagnostics.js';

export { Application } from '@pixi/app';
export {
  BaseTexture,
  Filter,
  Geometry,
  RenderTexture,
  Renderer,
  Shader,
  Texture,
} from '@pixi/core';
export {
  BLEND_MODES,
  MIPMAP_MODES,
  SCALE_MODES,
  WRAP_MODES,
} from '@pixi/constants';
export { Container } from '@pixi/display';
export { Graphics } from '@pixi/graphics';
export { Matrix, Point, Rectangle } from '@pixi/math';
export { Mesh } from '@pixi/mesh';
export { SimplePlane, SimpleRope } from '@pixi/mesh-extras';
export { Sprite } from '@pixi/sprite';
export { TilingSprite } from '@pixi/sprite-tiling';
export { Text } from '@pixi/text';
