import http from 'node:http';
import fs from 'node:fs/promises';

export const NATIVE_VIDEO_SKIP_HOST = 'native-video.localhost';
export const NATIVE_VIDEO_SKIP_PATTERN = `http://${NATIVE_VIDEO_SKIP_HOST}/*`;

function nativeVideoFixture() {
  const video = document.querySelector('video');
  const inputs = [];
  const events = [];
  const remember = (list, item) => { list.push(item); if (list.length > 160) list.shift(); };
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'keydown']) {
    window.addEventListener(type, event => remember(inputs, { type, trusted: event.isTrusted,
      at: performance.now(), target: event.target?.localName, x: event.clientX, y: event.clientY }), true);
  }
  for (const type of ['seeking', 'seeked', 'playing', 'pause', 'volumechange', 'error']) {
    video.addEventListener(type, event => remember(events, { type, trusted: event.isTrusted,
      at: performance.now(), time: video.currentTime, paused: video.paused }));
  }
  window.__entropyNativeVideoFixture = {
    read() {
      const rect = video.getBoundingClientRect();
      return { now: performance.now(), time: video.currentTime, duration: video.duration,
        paused: video.paused, muted: video.muted, volume: video.volume, controls: video.controls,
        readyState: video.readyState, seeking: video.seeking, error: video.error?.code ?? null,
        fullscreen: document.fullscreenElement === video,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        inputs: [...inputs], events: [...events] };
    },
    // Unprotected preparation only; protocol never invokes this during a measured seek.
    reset() { video.pause(); video.currentTime = 10; inputs.length = 0; events.length = 0; },
  };
}

export function renderNativeVideoSkipFixture() {
  return `<!doctype html><meta charset="utf-8"><title>Native video seek QA</title>
<style>body{margin:20px;background:#111;color:#eee;font:16px sans-serif}video{display:block;width:640px;height:360px}</style>
<h1>Native browser controls</h1><video controls muted preload="auto" playsinline src="/native.webm"></video>
<p>Local 180 second native VP8 media. No player library or replacement media methods.</p>
<script>(${nativeVideoFixture.toString()})();</script>`;
}

export async function createNativeVideoSkipFixture() {
  const clip = await fs.readFile(new URL('./fixtures/native-video-skip.webm', import.meta.url));
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.hostname !== NATIVE_VIDEO_SKIP_HOST) { response.writeHead(403); response.end(); return; }
    if (url.pathname === '/') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(renderNativeVideoSkipFixture()); return;
    }
    if (url.pathname !== '/native.webm') { response.writeHead(404); response.end(); return; }
    const match = /^bytes=(\d+)-(\d*)$/u.exec(request.headers.range || '');
    const start = match ? Number(match[1]) : 0;
    const end = match?.[2] ? Math.min(Number(match[2]), clip.length - 1) : clip.length - 1;
    if (start > end || start >= clip.length) {
      response.writeHead(416, { 'Content-Range': `bytes */${clip.length}` }); response.end(); return;
    }
    response.writeHead(match ? 206 : 200, { 'Content-Type': 'video/webm', 'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1, 'Cache-Control': 'no-store',
      ...(match ? { 'Content-Range': `bytes ${start}-${end}/${clip.length}` } : {}) });
    response.end(clip.subarray(start, end + 1));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://${NATIVE_VIDEO_SKIP_HOST}:${server.address().port}/`,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve({ closed: true })); server.closeAllConnections();
    }) };
}
