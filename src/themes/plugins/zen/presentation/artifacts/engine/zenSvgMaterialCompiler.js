import { rasterZenSvg, zenSvgDocument, zenSvgLayer, createZenSvgScope } from './zenSvgRaster.jsx';
import { buildZenTomeIshiScene } from './zenTomeIshiRecipe.jsx';
import { buildZenFurinMaterialLayers } from './zenFurinMaterials.js';
import { SHISHI_ODOSHI_GROUND_VIEW } from '../../../widgets/tools/recipes/zenShishiOdoshiGeometry.js';
import { buildZenShishiOdoshiBackdropScene, buildZenShishiOdoshiForegroundScene, buildZenShishiOdoshiRockScene,
  buildZenShishiOdoshiTubeScene, buildZenShishiOdoshiLiquidStreamScene,
  buildZenShishiOdoshiWaterDetailScene } from '../../../widgets/tools/recipes/zenShishiOdoshiSceneRecipe.jsx';

function tomeLayers({ color, nightDepth, isActive, visualWeight = Number(isActive) }) {
  const source = zenSvgDocument(buildZenTomeIshiScene({ ids: createZenSvgScope('zen-engine-tome'),
    color, nightDepth, visualWeight, shouldAnimate: false }), [0, 0, 340, 280]);
  const knot = source.querySelector('[data-tome-ishi-knot]');
  const knotSource = zenSvgLayer(source, knot); knot.remove();
  return [{ name: 'body', svg: source, bounds: [58, 0, 225, 280] },
    ...['drop-shadow(0 0 1px rgba(168,126,91,0.25))', 'drop-shadow(0 0 4px rgba(226,206,186,0.55))'].map((filter, index) => {
      const svg = knotSource.cloneNode(true);
      svg.querySelector('[data-tome-ishi-knot]').setAttribute('style', isActive ? `filter:${filter}` : '');
      return { name: index ? 'knot-high' : 'knot-low', svg, bounds: [140, 0, 70, 140] };
    })];
}

function shishiLayers({ color }) {
  const common = { idScope: createZenSvgScope('zen-engine-shishi'), color,
    groundTiltDeg: SHISHI_ODOSHI_GROUND_VIEW.tiltDeg, groundAspect: SHISHI_ODOSHI_GROUND_VIEW.ellipseAspect };
  const layer = (name, scene, bounds) => ({ name, svg: zenSvgDocument(scene, bounds), bounds });
  const tube = buildZenShishiOdoshiTubeScene(common);
  const tubeLayers = (name, nodes, defs) => ['0 15px 10px rgba(0,0,0,.3)', '0 5px 6.5px rgba(0,0,0,.58)'].map((shadow, index) => {
    const bounds = [-30,-20,360,105];
    const source = zenSvgDocument({ nodes, defs }, bounds);
    const group = source.createElementNS('http://www.w3.org/2000/svg', 'g');
    for (const child of [...source.documentElement.children]) if (child.tagName !== 'defs') group.appendChild(child);
    source.documentElement.appendChild(group);
    group.setAttribute('style', `filter:drop-shadow(${shadow})`);
    return { name: name + (index ? '-near' : '-far'), svg: source, bounds };
  });
  return [layer('backdrop', buildZenShishiOdoshiBackdropScene(common), [130,120,60,210]),
    layer('rock', buildZenShishiOdoshiRockScene(common), [245,230,120,95]),
    ...tubeLayers('tube-back', tube.backNodes, tube.backDefs), ...tubeLayers('tube-front', tube.frontNodes, tube.frontDefs),
    layer('water', buildZenShishiOdoshiLiquidStreamScene({ ...common, captureStemHeight:730,streamSpread:1,
      streamBaseOpacity:1,streamCoreOpacity:.84,freeFallBaseOpacity:0,freeFallCoreOpacity:0,
      captureTailLength:0,captureTailRotate:0,captureTailOpacity:0,shouldAnimateMotion:false }), [28,-390,34,730]),
    layer('water-ripple', buildZenShishiOdoshiWaterDetailScene({ ...common, part: 'ripple' }), [-18,-18,36,36]),
    layer('water-crown', buildZenShishiOdoshiWaterDetailScene({ ...common, part: 'crown' }), [-20,-18,40,24]),
    layer('water-contact', buildZenShishiOdoshiWaterDetailScene({ ...common, part: 'contact' }), [-14,-14,28,28]),
    layer('water-droplet', buildZenShishiOdoshiWaterDetailScene({ ...common, part: 'droplet' }), [-4,-4,8,8]),
    layer('foreground', buildZenShishiOdoshiForegroundScene(common), [145,130,60,205])];
}

const BUILDERS = Object.freeze({ 'tome-ishi': tomeLayers, furin: buildZenFurinMaterialLayers, 'shishi-odoshi': shishiLayers });

// UI-only canonical SVG compiler. No Pixi import, scene graph, or retained cache.
// The receiver owns each transferred bitmap until its material cache releases it.
export async function compileZenArtifactSvgMaterials(descriptor, resolution) {
  const builder = BUILDERS[descriptor.id];
  if (!builder) throw new Error('ZEN_ARTIFACT_SVG_COMPILER_ID_INVALID');
  const layers = [];
  try {
    for (const { name, svg, bounds } of builder(descriptor)) {
      const canvas = await rasterZenSvg(svg, bounds, resolution);
      const bitmap = await createImageBitmap(canvas);
      layers.push({ name, bounds, bitmap });
    }
    return layers;
  } catch (error) { layers.forEach(layer => layer.bitmap.close()); throw error; }
}
