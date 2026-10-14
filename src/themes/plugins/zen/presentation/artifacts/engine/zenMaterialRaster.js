import { settings } from '@pixi/settings';
// One-time compiler for the small gradient/shadow vocabulary in Zen recipes.
// This is deliberately not a DOM/CSS renderer; unsupported recipe syntax fails.
export function createZenRaster(width, height, resolution, paint) {
  const canvas = settings.ADAPTER.createCanvas();
  canvas.width = Math.ceil(width * resolution);
  canvas.height = Math.ceil(height * resolution);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ZEN_ARTIFACT_MATERIAL_CANVAS_UNAVAILABLE');
  context.scale(resolution, resolution);
  paint(context);
  return canvas;
}

export function splitZenLayers(source) {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    if (source[i] === ')') depth -= 1;
    if (source[i] === ',' && depth === 0) {
      result.push(source.slice(start, i).trim());
      start = i + 1;
    }
  }
  result.push(source.slice(start).trim());
  return result;
}

function readStops(tokens, length) {
  return tokens.flatMap((token) => {
    const match = /^(rgba?\([^)]*\)|#[\da-f]+|transparent)\s+(.+)$/i.exec(token);
    if (!match) throw new Error(`ZEN_MATERIAL_STOP_UNSUPPORTED: ${token}`);
    return match[2].split(/\s+/).map((position) => ({
      color: match[1],
      offset: position.endsWith('%') ? parseFloat(position) / 100 : parseFloat(position) / length,
    }));
  });
}

function paintLinear(context, source, width, height, repeating) {
  const [direction, ...tokens] = splitZenLayers(source);
  const angle = Number(direction.replace('deg', '')) * Math.PI / 180;
  if (!Number.isFinite(angle)) throw new Error(`ZEN_MATERIAL_ANGLE_UNSUPPORTED: ${direction}`);
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const stops = readStops(tokens, length);
  const gradient = context.createLinearGradient(
    width / 2 - dx * length / 2, height / 2 - dy * length / 2,
    width / 2 + dx * length / 2, height / 2 + dy * length / 2,
  );
  if (repeating) {
    const period = stops.at(-1).offset;
    if (!(period > 0)) throw new Error('ZEN_MATERIAL_REPEAT_PERIOD_INVALID');
    for (let cycle = 0; cycle * period <= 1; cycle += 1) {
      for (const stop of stops) {
        const offset = cycle * period + stop.offset;
        if (offset <= 1) gradient.addColorStop(offset, stop.color);
      }
    }
  } else {
    for (const stop of stops) gradient.addColorStop(stop.offset, stop.color);
  }
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function paintRadial(context, source, width, height) {
  const [shape, ...tokens] = splitZenLayers(source);
  const match = /^(circle|ellipse) at (?:(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%|center)$/.exec(shape);
  if (!match) throw new Error(`ZEN_MATERIAL_RADIAL_UNSUPPORTED: ${shape}`);
  const cx = match[2] === undefined ? width / 2 : width * Number(match[2]) / 100;
  const cy = match[3] === undefined ? height / 2 : height * Number(match[3]) / 100;
  const maxX = Math.max(cx, width - cx);
  const maxY = Math.max(cy, height - cy);
  const radiusX = match[1] === 'circle' ? Math.hypot(maxX, maxY) : maxX * Math.SQRT2;
  const radiusY = match[1] === 'circle' ? radiusX : maxY * Math.SQRT2;
  context.save();
  context.translate(cx, cy);
  context.scale(radiusX, radiusY);
  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
  for (const stop of readStops(tokens, 1)) gradient.addColorStop(stop.offset, stop.color);
  context.fillStyle = gradient;
  context.fillRect(-cx / radiusX, -cy / radiusY, width / radiusX, height / radiusY);
  context.restore();
}

export function paintZenBackground(context, source, x, y, width, height) {
  context.save();
  context.translate(x, y);
  for (const layer of splitZenLayers(source).reverse()) {
    const match = /^(repeating-linear|linear|radial)-gradient\((.*)\)$/.exec(layer);
    if (match) {
      if (match[1] === 'radial') paintRadial(context, match[2], width, height);
      else paintLinear(context, match[2], width, height, match[1] === 'repeating-linear');
    } else {
      if (!/^(#[\da-f]+|rgba?\([^)]*\)|transparent)$/i.test(layer)) {
        throw new Error(`ZEN_MATERIAL_BACKGROUND_UNSUPPORTED: ${layer}`);
      }
      context.fillStyle = layer;
      context.fillRect(0, 0, width, height);
    }
  }
  context.restore();
}

export function paintZenBoxShadows(context, source, x, y, width, height, resolution) {
  if (source === 'none') return;
  for (const layer of splitZenLayers(source).reverse()) {
    const match = /^(inset\s+)?(.+?)\s+(rgba?\([^)]*\)|#[\da-f]+)$/.exec(layer);
    if (!match) throw new Error(`ZEN_MATERIAL_SHADOW_UNSUPPORTED: ${layer}`);
    const values = match[2].split(/\s+/).map(parseFloat);
    const [offsetX, offsetY, blur = 0, spread = 0] = values;
    if (values.some((value) => !Number.isFinite(value))) throw new Error('ZEN_MATERIAL_SHADOW_INVALID');
    context.save();
    // Blur the colored silhouette once. Canvas shadowColor multiplied by a
    // translucent source would square its alpha and weaken the CSS shadow.
    context.filter = `blur(${blur * resolution / 2}px)`;
    context.fillStyle = match[3];
    if (match[1]) {
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      const margin = 200;
      context.beginPath();
      context.rect(x - margin, y - margin, width + margin * 2, height + margin * 2);
      context.rect(x + spread + offsetX, y + spread + offsetY, width - spread * 2, height - spread * 2);
      context.fill('evenodd');
    } else {
      context.fillRect(x - spread + offsetX, y - spread + offsetY, width + spread * 2, height + spread * 2);
    }
    context.restore();
  }
}
