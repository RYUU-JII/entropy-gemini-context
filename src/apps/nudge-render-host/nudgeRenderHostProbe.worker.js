import {
  NUDGE_EXTENSION_FRAME_WORKER_PROBE,
} from '../../domains/nudge/runtime/NudgeExtensionFrameWorkerProbeProtocol.js';

let canvas = null;
let ctx = null;
let startedAt = 0;
let durationMs = 2200;
let width = 160;
let height = 96;
let frameCount = 0;
let firstFrameSent = false;
let loopHandle = null;

function nowMs() {
  return typeof self.performance?.now === 'function' ? self.performance.now() : Date.now();
}

function post(phase, payload = null, error = null) {
  self.postMessage({
    type: phase,
    phase,
    payload,
    error,
    sentAt: Date.now(),
  });
}

function scheduleFrame(callback) {
  if (typeof self.requestAnimationFrame === 'function') {
    loopHandle = self.requestAnimationFrame(callback);
    return;
  }
  loopHandle = self.setTimeout(() => callback(nowMs()), 16);
}

function cancelFrame() {
  if (loopHandle === null) return;
  if (typeof self.cancelAnimationFrame === 'function') {
    self.cancelAnimationFrame(loopHandle);
  } else {
    self.clearTimeout(loopHandle);
  }
  loopHandle = null;
}

function drawFrame(ts) {
  const elapsedMs = Math.max(0, ts - startedAt);
  const t = elapsedMs / 1000;
  frameCount += 1;

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#081c1f');
  gradient.addColorStop(0.55, '#153a37');
  gradient.addColorStop(1, '#d7b56d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#f8efd0';
  ctx.lineWidth = 1;
  for (let y = 14; y < height; y += 18) {
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const wave = Math.sin((x * 0.05) + t * 2.2 + y * 0.08) * 3;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const koiX = width * (0.18 + 0.64 * ((Math.sin(t * 1.4) + 1) / 2));
  const koiY = height * (0.52 + 0.22 * Math.sin(t * 2.1));
  ctx.save();
  ctx.translate(koiX, koiY);
  ctx.rotate(Math.sin(t * 1.6) * 0.35);
  ctx.fillStyle = '#f6dca2';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c7523f';
  ctx.beginPath();
  ctx.ellipse(-4, -1, 6, 3, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f3c96e';
  ctx.beginPath();
  ctx.moveTo(-18, 0);
  ctx.lineTo(-30, -8);
  ctx.lineTo(-26, 0);
  ctx.lineTo(-30, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.commit?.();

  if (!firstFrameSent) {
    firstFrameSent = true;
    post(NUDGE_EXTENSION_FRAME_WORKER_PROBE.FIRST_FRAME, {
      frameCount,
      elapsedMs: Math.round(elapsedMs * 10) / 10,
      supportsWorkerRaf: typeof self.requestAnimationFrame === 'function',
    });
  }

  if (elapsedMs >= durationMs) {
    post(NUDGE_EXTENSION_FRAME_WORKER_PROBE.COMPLETE, {
      frameCount,
      elapsedMs: Math.round(elapsedMs * 10) / 10,
      supportsWorkerRaf: typeof self.requestAnimationFrame === 'function',
    });
    return;
  }

  scheduleFrame(drawFrame);
}

self.onmessage = (event) => {
  const message = event?.data || {};
  if (message.type !== 'INIT') return;

  try {
    canvas = message.canvas || null;
    width = Math.max(1, Math.round(Number(message.width) || width));
    height = Math.max(1, Math.round(Number(message.height) || height));
    durationMs = Math.max(300, Math.min(8000, Math.round(Number(message.durationMs) || durationMs)));
    if (!canvas || typeof canvas.getContext !== 'function') {
      throw new Error('probe_worker_canvas_unavailable');
    }
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('probe_worker_canvas_context_unavailable');
    }
    startedAt = nowMs();
    frameCount = 0;
    firstFrameSent = false;
    cancelFrame();
    post(NUDGE_EXTENSION_FRAME_WORKER_PROBE.WORKER_READY, {
      width,
      height,
      durationMs,
      supportsWorkerRaf: typeof self.requestAnimationFrame === 'function',
    });
    scheduleFrame(drawFrame);
  } catch (error) {
    post(
      NUDGE_EXTENSION_FRAME_WORKER_PROBE.ERROR,
      null,
      String(error?.message || error || 'probe_worker_start_failed'),
    );
  }
};
