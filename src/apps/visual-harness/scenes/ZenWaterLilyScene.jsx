import React from 'react';

import {
  WATER_LILY_STAGE_BLOOM,
  WATER_LILY_STAGE_BUD,
  WATER_LILY_STAGE_OPENING,
  drawWaterLilyRefined,
} from '../../../themes/plugins/zen/pond/world/decor/decorLilyPadWaterLily.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import './zenWaterLilyScene.css';

// Isolated bloom review. The pond renders the water lily at 20-40px on a moving
// surface, which is far too small to judge blade silhouette or how the light
// sits on the rosette. Every tile here runs the same production renderer at a
// size where those are legible.
const HERO_SIZE = 210;
const TILE_SIZE = 108;
const PRODUCTION_SIZES = Object.freeze([24, 32, 40, 48]);

const TILES = Object.freeze([
  { stage: WATER_LILY_STAGE_BLOOM, color: 'sakura', label: 'bloom · sakura' },
  { stage: WATER_LILY_STAGE_BLOOM, color: 'buttercream', label: 'bloom · buttercream' },
  { stage: WATER_LILY_STAGE_BLOOM, color: 'peach', label: 'bloom · peach' },
  { stage: WATER_LILY_STAGE_BLOOM, color: 'alabaster', label: 'bloom · alabaster' },
  { stage: WATER_LILY_STAGE_OPENING, color: 'sakura', label: 'opening · sakura' },
  { stage: WATER_LILY_STAGE_BUD, color: 'white', label: 'bud · calyx' },
]);

// drawWaterLilyRefined caches its baked sprite on the entity it is handed, so
// each tile gets its own carrier rather than sharing one and thrashing the key.
function createFlower(stage, color, phase, openAmount = null) {
  return {
    flowerStage: stage,
    flowerColor: color,
    flowerPhase: phase,
    ...(Number.isFinite(openAmount) ? { flowerOpenAmount: openAmount } : {}),
  };
}

function paint(canvas, {
  stage,
  color,
  size,
  phase,
  openAmount = null,
  scale,
}) {
  if (!canvas) return;
  const dpr = 2;
  const box = size * 3;
  canvas.width = box * dpr;
  canvas.height = box * dpr;
  canvas.style.width = `${box}px`;
  canvas.style.height = `${box}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, box, box);
  ctx.save();
  ctx.translate(box * 0.5, box * 0.5);
  if (scale && scale !== 1) ctx.scale(scale, scale);
  drawWaterLilyRefined(createFlower(stage, color, phase, openAmount), ctx, size, 1);
  ctx.restore();
}

function ZenWaterLilyScene({ signalReady }) {
  const heroRef = React.useRef(null);
  const tileRefs = React.useRef([]);
  const productionRefs = React.useRef([]);

  React.useLayoutEffect(() => {
    paint(heroRef.current, {
      stage: WATER_LILY_STAGE_BLOOM,
      color: 'pink',
      size: HERO_SIZE,
      phase: 0.42,
    });
    TILES.forEach((tile, index) => {
      paint(tileRefs.current[index], {
        stage: tile.stage,
        color: tile.color,
        size: TILE_SIZE,
        phase: 0.18 + index * 0.31,
      });
    });
    PRODUCTION_SIZES.forEach((size, index) => {
      paint(productionRefs.current[index], {
        stage: WATER_LILY_STAGE_BLOOM,
        color: index % 2 === 0 ? 'sakura' : 'alabaster',
        size,
        phase: 0.42 + index * 0.17,
      });
    });
    signalReady?.();
  }, [signalReady]);

  return (
    <main className="visual-water-lily-page">
      <section
        className="visual-water-lily-scene"
        data-visual-capture="water-lily-scene"
        aria-label="Zen water lily bloom visual scene"
      >
        <div
          className="visual-water-lily-hero"
          data-visual-capture="water-lily-hero"
        >
          <canvas ref={heroRef} aria-label="Water lily bloom, pink" />
        </div>
        <div
          className="visual-water-lily-grid"
          data-visual-capture="water-lily-grid"
        >
          {TILES.map((tile, index) => (
            <figure className="visual-water-lily-tile" key={tile.label}>
              <canvas
                ref={(node) => {
                  tileRefs.current[index] = node;
                }}
                aria-label={tile.label}
              />
              <figcaption>{tile.label}</figcaption>
            </figure>
          ))}
        </div>
        <div
          className="visual-water-lily-production"
          data-visual-capture="water-lily-production"
          aria-label="Water lily production size specimens"
        >
          {PRODUCTION_SIZES.map((size, index) => (
            <figure className="visual-water-lily-production-sample" key={size}>
              <canvas
                ref={(node) => {
                  productionRefs.current[index] = node;
                }}
                aria-label={`Water lily at ${size} pixels`}
              />
              <figcaption>{size}px</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}

export default defineVisualSceneImplementation({
  Component: ZenWaterLilyScene,
});
