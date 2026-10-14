import { createCanvas } from '@napi-rs/canvas';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Original motion recipe. Run explicitly; builds use the checked-in small media.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(root, 'src/apps/feed-landing/assets/shortform');
await mkdir(output, { recursive: true });
const width = 480;
const height = 854;
const fps = 24;
const seconds = 6;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');
const encoder = spawn('ffmpeg.exe', [
  '-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pixel_format', 'rgba',
  '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', 'pipe:0',
  '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', resolve(output, 'ribbon-loop.mp4'),
], { stdio: ['pipe', 'ignore', 'inherit'], windowsHide: true });
const completion = once(encoder, 'close');

function draw(time) {
  const phase = time * Math.PI * 2;
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#182c33');
  bg.addColorStop(0.48, '#3d344b');
  bg.addColorStop(1, '#131f24');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);
  const glow = ctx.createRadialGradient(260, 360, 10, 260, 360, 360);
  glow.addColorStop(0, '#bc7d7955');
  glow.addColorStop(0.6, '#d4996f16');
  glow.addColorStop(1, '#ac9a7400');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e1b6a624';
  ctx.beginPath();
  ctx.ellipse(325, 175, 54, 54, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8cdc415';
  ctx.lineWidth = 0.6;
  for (let line = 0; line < 17; line += 1) {
    ctx.beginPath(); ctx.moveTo(0, 648 + line * 15); ctx.lineTo(width, 648 + line * 15); ctx.stroke();
  }
  const centerY = 414 + Math.sin(phase) * 12;
  // Depth-sorted filaments form one continuously turning, iridescent ribbon.
  const filaments = Array.from({ length: 92 }, (_, index) => {
    const angle = index / 92 * Math.PI * 2;
    return { angle, depth: Math.sin(angle + phase) };
  }).sort((a, b) => a.depth - b.depth);
  for (const { angle, depth } of filaments) {
    ctx.beginPath();
    for (let step = 0; step <= 160; step += 1) {
      const theta = step / 160 * Math.PI * 2;
      const bend = theta * 2 + phase;
      const radius = 125 + Math.cos(angle + bend) * 35;
      const x = 240 + Math.cos(theta) * radius + Math.sin(bend) * 24;
      const y = centerY + Math.sin(theta) * radius * 1.22 + Math.sin(angle + bend) * 34;
      if (step === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const hue = 25 + (Math.cos(angle + phase) + 1) * 68;
    ctx.strokeStyle = `hsla(${hue}, ${48 + depth * 12}%, ${64 + depth * 17}%, ${0.28 + (depth + 1) * 0.25})`;
    ctx.lineWidth = 0.85 + (depth + 1) * 0.35;
    ctx.stroke();
  }
  const shade = ctx.createRadialGradient(240, 430, 170, 240, 430, 540);
  shade.addColorStop(0, '#050b0e00');
  shade.addColorStop(1, '#050b0ec9');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
}

for (let frame = 0; frame < fps * seconds; frame += 1) {
  draw(frame / (fps * seconds));
  if (frame === 0) await writeFile(resolve(output, 'ribbon-poster.webp'), canvas.toBuffer('image/webp'));
  const pixels = ctx.getImageData(0, 0, width, height).data;
  if (!encoder.stdin.write(Buffer.from(pixels))) await once(encoder.stdin, 'drain');
}
encoder.stdin.end();
const [exitCode] = await completion;
if (exitCode !== 0) throw new Error(`SHORTFORM_VIDEO_ENCODING_FAILED:${exitCode}`);
console.log(`Original short-form video written: ${width}x${height}, ${seconds}s, ${fps}fps.`);
