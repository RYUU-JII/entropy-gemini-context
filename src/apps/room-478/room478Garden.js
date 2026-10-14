const plate = (href, width, height, furin, water) => Object.freeze({
  href, width, height, furin: Object.freeze(furin), water: Object.freeze(water),
});

export const ROOM478_GARDEN_PLATES = Object.freeze({
  wide: plate(new URL('./assets/zen-garden-wide-hybrid-v4.webp', import.meta.url).href,
    1536, 1024, { x: 0.137, y: 0.064, height: 0.22 },
    { x: 0.719, y: 0.672, width: 0.195, height: 0.071 }),
  portrait: plate(new URL('./assets/zen-garden-portrait-hybrid-v4.webp', import.meta.url).href,
    941, 1672, { x: 0.120, y: 0.061, height: 0.142 },
    { x: 0.712, y: 0.653, width: 0.223, height: 0.063 }),
  panorama: plate(new URL('./assets/zen-garden-panorama-hybrid-v4.webp', import.meta.url).href,
    1915, 821, { x: 0.085, y: 0.065, height: 0.217 },
    { x: 0.623, y: 0.724, width: 0.315, height: 0.077 }),
});

export const ROOM478_GARDEN_FURIN = Object.freeze({
  href: new URL('./assets/zen-furin-hybrid-v4.webp', import.meta.url).href,
  width: 1024, height: 1536, x: 357, y: 24,
  cropWidth: 313, cropHeight: 1430, pivotX: 0.505, pivotY: 0.0014,
});

// Plate coordinates own both the static image and its small reflection crop.
// Foreground placement can move inward along the eave when cover crops the roof.
export function resolveRoom478GardenLayout(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('room_478_garden_bounds_invalid');
  }
  const ratio = width / height;
  const key = ratio <= 0.95 ? 'portrait' : ratio >= 2 ? 'panorama' : 'wide';
  const selected = ROOM478_GARDEN_PLATES[key];
  const scale = Math.max(width / selected.width, height / selected.height);
  const drawWidth = selected.width * scale;
  const drawHeight = selected.height * scale;
  const left = (width - drawWidth) / 2;
  const top = (height - drawHeight) / 2;
  const furinHeight = selected.furin.height * drawHeight;
  const sprite = ROOM478_GARDEN_FURIN;
  const furinScale = furinHeight / sprite.cropHeight;
  const furinWidth = sprite.cropWidth * furinScale;
  return {
    key, href: selected.href, width, height, scale, left, top, drawWidth, drawHeight,
    furin: {
      x: Math.max(selected.furin.x * drawWidth, Math.min(width * 0.14, 64) - left)
        - furinWidth * sprite.pivotX,
      y: Math.max(selected.furin.y * drawHeight, -top - 3) - furinHeight * sprite.pivotY,
      width: furinWidth, height: furinHeight, scale: furinScale,
    },
    water: {
      x: selected.water.x * drawWidth, y: selected.water.y * drawHeight,
      width: selected.water.width * drawWidth, height: selected.water.height * drawHeight,
    },
    moon: {
      x: width * 0.53, y: height * (ratio <= 0.95 ? 0.32 : 0.30),
      diameter: Math.max(64, Math.min(132, Math.min(width, height) * 0.138)),
    },
  };
}

export function applyRoom478GardenLayout(surface, width, height) {
  const viewport = `${width}:${height}`;
  if (surface.root.dataset.room478GardenViewport === viewport) return;
  const layout = resolveRoom478GardenLayout(width, height);
  const { furin, water } = layout;
  const sprite = ROOM478_GARDEN_FURIN;
  Object.assign(surface.gardenStage.style, {
    left: `${layout.left}px`, top: `${layout.top}px`,
    width: `${layout.drawWidth}px`, height: `${layout.drawHeight}px`,
  });
  Object.assign(surface.gardenWater.style, {
    left: `${water.x}px`, top: `${water.y}px`,
    width: `${water.width}px`, height: `${water.height}px`,
  });
  Object.assign(surface.gardenReflection.style, {
    backgroundSize: `${layout.drawWidth}px ${layout.drawHeight}px`,
    backgroundPosition: `${-water.x}px ${-water.y}px`,
  });
  Object.assign(surface.gardenFurin.style, {
    left: `${furin.x}px`, top: `${furin.y}px`,
    width: `${furin.width}px`, height: `${furin.height}px`,
    transformOrigin: `${sprite.pivotX * 100}% ${sprite.pivotY * 100}%`,
  });
  Object.assign(surface.gardenFurinImage.style, {
    width: `${sprite.width * furin.scale}px`, height: `${sprite.height * furin.scale}px`,
    left: `${-sprite.x * furin.scale}px`, top: `${-sprite.y * furin.scale}px`,
  });
  surface.root.style.setProperty('--room478-moon-x', `${layout.moon.x}px`);
  surface.root.style.setProperty('--room478-moon-y', `${layout.moon.y}px`);
  surface.root.style.setProperty('--room478-moon-size', `${layout.moon.diameter}px`);
  if (surface.garden.dataset.plate !== layout.key) {
    surface.gardenImage.src = layout.href;
    surface.gardenReflection.style.backgroundImage = `url("${layout.href}")`;
    surface.garden.dataset.plate = layout.key;
  }
  surface.root.dataset.room478GardenViewport = viewport;
}

// The experience owns failure settlement and document lifetime. This port owns
// only the exact two images; CSS and the existing frame loop own presentation.
export function bindRoom478GardenAssetLifetime(surface, onError) {
  if (typeof onError !== 'function') throw new Error('room_478_garden_error_port_missing');
  let destroyed = false;
  let failed = false;
  const handlers = [
    [surface.gardenImage, 'plate'],
    [surface.gardenFurinImage, 'furin'],
  ].map(([image, role]) => {
    function fail() {
      if (destroyed || failed) return;
      failed = true;
      onError(new Error(`room_478_garden_asset_unavailable:${role}`));
    }
    image.addEventListener('error', fail);
    return [image, fail];
  });
  return Object.freeze({
    destroy() {
      if (destroyed) return;
      destroyed = true;
      handlers.forEach(([image, handler]) => image.removeEventListener('error', handler));
    },
  });
}
