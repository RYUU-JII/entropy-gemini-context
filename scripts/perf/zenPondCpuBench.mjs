import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const out = {
    root: process.cwd(),
    label: 'current',
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root' && argv[i + 1]) {
      out.root = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--label' && argv[i + 1]) {
      out.label = String(argv[i + 1]);
      i += 1;
      continue;
    }
  }
  return out;
}

function quantile(values, q) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * q)));
  return sorted[idx];
}

function summarize(samples) {
  if (!samples.length) {
    return {
      samples: 0,
      mean_ms: 0,
      p95_ms: 0,
      min_ms: 0,
      max_ms: 0,
    };
  }
  const sum = samples.reduce((acc, v) => acc + v, 0);
  return {
    samples: samples.length,
    mean_ms: sum / samples.length,
    p95_ms: quantile(samples, 0.95),
    min_ms: Math.min(...samples),
    max_ms: Math.max(...samples),
  };
}

function createRng(seed = 0x12345678) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

class MockGradient {
  addColorStop() {}
}

class MockPattern {
  setTransform() {}
}

class MockDOMMatrix {
  constructor() {
    this.a = 1;
    this.b = 0;
    this.c = 0;
    this.d = 1;
    this.e = 0;
    this.f = 0;
  }
  translateSelf(x = 0, y = 0) {
    this.e += x;
    this.f += y;
    return this;
  }
  scaleSelf(x = 1, y = 1) {
    this.a *= x;
    this.d *= y;
    return this;
  }
}

class MockCanvasContext2D {
  constructor() {
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.lineWidth = 1;
    this.shadowColor = '#000';
    this.shadowBlur = 0;
    this.lineCap = 'butt';
    this.textAlign = 'left';
    this.font = '12px sans-serif';
  }
  save() {}
  restore() {}
  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  arc() {}
  ellipse() {}
  fill() {}
  stroke() {}
  clip() {}
  roundRect() {}
  translate() {}
  rotate() {}
  scale() {}
  setTransform() {}
  fillText() {}
  measureText(text) {
    const len = String(text || '').length;
    return { width: len * 6.5 };
  }
  drawImage() {}
  createLinearGradient() {
    return new MockGradient();
  }
  createRadialGradient() {
    return new MockGradient();
  }
  createPattern() {
    return new MockPattern();
  }
}

class MockCanvas {
  constructor() {
    this.width = 0;
    this.height = 0;
    this._ctx = new MockCanvasContext2D();
  }
  getContext() {
    return this._ctx;
  }
}

function installDomMocks() {
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = MockDOMMatrix;
  if (!globalThis.document) {
    globalThis.document = {
      createElement(tag) {
        if (tag === 'canvas') return new MockCanvas();
        return {};
      },
    };
  }
}

async function importModuleFromRoot(root, relPath) {
  const fullPath = path.join(root, relPath);
  return import(pathToFileURL(fullPath).href);
}

function runTimed(frames, work) {
  const samples = [];
  for (let i = 0; i < frames; i += 1) {
    const t0 = performance.now();
    work(i);
    samples.push(performance.now() - t0);
  }
  return summarize(samples);
}

async function benchWaterLily(root) {
  const { drawWaterLily } = await importModuleFromRoot(
    root,
    'src/themes/plugins/zen/widgets/signals/signalScanner/decor/decorLilyPadWaterLily.js',
  );
  const ctx = new MockCanvasContext2D();
  const stages = ['bud', 'opening', 'bloom'];
  const colors = ['pink', 'white'];
  const rng = createRng(0x77aa33cc);
  const flowers = Array.from({ length: 18 }, (_, i) => ({
    flowerStage: stages[i % stages.length],
    flowerColor: colors[i % colors.length],
    flowerPhase: rng() * Math.PI * 2,
  }));
  const sizes = flowers.map(() => 14 + rng() * 16);

  runTimed(80, () => {
    for (let repeat = 0; repeat < 4; repeat += 1) {
      for (let i = 0; i < flowers.length; i += 1) {
        drawWaterLily(flowers[i], ctx, sizes[i]);
      }
    }
  });
  return runTimed(300, () => {
    for (let repeat = 0; repeat < 4; repeat += 1) {
      for (let i = 0; i < flowers.length; i += 1) {
        drawWaterLily(flowers[i], ctx, sizes[i]);
      }
    }
  });
}

async function benchPattern(root) {
  const { koiFishRenderPatternMethods } = await importModuleFromRoot(
    root,
    'src/themes/plugins/zen/widgets/signals/signalScanner/koiFishRenderPatternMethods.js',
  );
  const drawPattern = koiFishRenderPatternMethods.drawPattern;
  const ctx = new MockCanvasContext2D();
  const rng = createRng(0x9f31b2c1);

  const history = Array.from({ length: 31 }, (_, i) => ({
    x: i * 3.1,
    y: 120 + Math.sin(i * 0.32) * 12,
    angle: Math.sin(i * 0.2) * 0.45,
  }));
  const patternMarks = Array.from({ length: 32 }, (_, i) => ({
    t: 0.08 + (i / 33) * 0.84,
    side: (rng() - 0.5) * 0.8,
    scale: 0.12 + rng() * 0.5,
    color: i % 5 === 0 ? 'secondary' : (i % 7 === 0 ? 'accent' : 'pattern'),
    kind: i % 3 === 0 ? 'patch' : (i % 3 === 1 ? 'spot' : 'circle'),
    noiseOffset: rng() * 10,
  }));
  const fish = {
    patternStyle: 'patches-dual',
    patternMarks,
    colorPattern: '#E64A19',
    colorSecondary: '#212121',
    colorAccent: '#B71C1C',
    variant: 'elegant',
    history,
    getBodyRadius(t, size) {
      return size * (0.9 - t * 0.6);
    },
  };

  runTimed(80, () => {
    for (let repeat = 0; repeat < 32; repeat += 1) {
      drawPattern.call(fish, ctx, 18);
    }
  });
  return runTimed(480, () => {
    for (let repeat = 0; repeat < 32; repeat += 1) {
      drawPattern.call(fish, ctx, 18);
    }
  });
}

function benchPointerFind() {
  const rng = createRng(0x11335577);
  const fish = Array.from({ length: 24 }, (_, idx) => ({
    id: idx,
    containsPoint(x, y) {
      return ((x * 31 + y * 17 + idx * 13) % 97) === 3;
    },
  }));
  const points = Array.from({ length: 2000 }, () => ({
    x: Math.floor(rng() * 1200),
    y: Math.floor(rng() * 800),
  }));

  const oldSample = [];
  const nextSample = [];

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const t0 = performance.now();
    [...fish].reverse().find((f) => f.containsPoint(p.x, p.y));
    oldSample.push(performance.now() - t0);

    const t1 = performance.now();
    for (let j = fish.length - 1; j >= 0; j -= 1) {
      if (fish[j].containsPoint(p.x, p.y)) break;
    }
    nextSample.push(performance.now() - t1);
  }
  return {
    old: summarize(oldSample),
    next: summarize(nextSample),
  };
}

function benchTuningAssign() {
  const fish = Array.from({ length: 48 }, () => ({ tuning: null }));
  const tuning = {
    speed: 1.3,
    pectoralSize: 1.5,
    physics: {
      swimModel: 'event_fsm',
      accelScale: 2.5,
      frictionScale: 1.05,
    },
  };
  const activityScale = 0.9;
  const iterations = 6000;
  const oldSamples = [];
  const nextSamples = [];

  for (let iter = 0; iter < iterations; iter += 1) {
    const t0 = performance.now();
    for (let i = 0; i < fish.length; i += 1) {
      const combinedTuning = {
        ...tuning,
        physics: {
          ...tuning.physics,
          baseCruiseSpeed: (tuning.physics.baseCruiseSpeed || 0.05) * activityScale,
          turnRateRef: (tuning.physics.turnRateRef || 0.078) * activityScale,
        },
      };
      fish[i].tuning = combinedTuning;
    }
    oldSamples.push(performance.now() - t0);

    const t1 = performance.now();
    for (let i = 0; i < fish.length; i += 1) {
      fish[i].tuning = tuning;
    }
    nextSamples.push(performance.now() - t1);
  }

  return {
    old: summarize(oldSamples),
    next: summarize(nextSamples),
  };
}

async function main() {
  installDomMocks();
  const args = parseArgs(process.argv);

  const [waterLily, pattern] = await Promise.all([
    benchWaterLily(args.root),
    benchPattern(args.root),
  ]);

  const pointerFind = benchPointerFind();
  const tuningAssign = benchTuningAssign();

  const report = {
    label: args.label,
    root: args.root,
    generated_at: new Date().toISOString(),
    waterLily,
    pattern,
    pointerFind,
    tuningAssign,
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error('[zenPondCpuBench] failed:', error);
  process.exitCode = 1;
});
