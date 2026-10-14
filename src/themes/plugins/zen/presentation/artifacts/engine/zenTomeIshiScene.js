import { Container } from '../../../runtime/worker/zenPixiWorkerRuntime.js';
import { zenEaseInOut } from './zenArtifactTiming.js';

export async function createZenTomeIshiScene({ color, nightDepth, isActive, visualWeight = Number(isActive), assets, resolution }) {
  const root = new Container();
  const body = new Container();
  root.addChild(body);
  body.position.set(-170, -140);
  try {
    body.addChild(assets.sprite('body'));
    const knots = [];
    for (const name of ['knot-low', 'knot-high']) {
      const sprite = assets.sprite(name);
      knots.push(sprite);
      body.addChild(sprite);
    }
    return {
      root, geometry: { sprites: 3, liveFilters: 0, source: 'canonical SVG layers' },
      update(atMs) {
        const t = (atMs % 4500) / 4500;
        const weight = isActive ? zenEaseInOut(t < 0.5 ? t * 2 : (1 - t) * 2) : 0;
        const opacity = isActive ? 0.9 + 0.1 * weight : 0.92;
        knots[0].alpha = opacity * (1 - weight);
        knots[1].alpha = opacity * weight;
      },
    };
  } catch (failure) { root.destroy({ children: true }); throw failure; }
}
