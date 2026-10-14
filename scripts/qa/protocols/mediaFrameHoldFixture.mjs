import http from 'node:http';
import { randomUUID } from 'node:crypto';

export const MEDIA_FRAME_HOLD_HOSTS = Object.freeze([
  'frame-top.localhost', 'frame-child.localhost', 'frame-nested.localhost',
]);
export const MEDIA_FRAME_HOLD_PATTERNS = Object.freeze(MEDIA_FRAME_HOLD_HOSTS.map(host => `http://${host}/*`));

function nativeMediaFixture({ node, childOrigin, parentOrigin, token, revision }) {
  const instanceId = crypto.randomUUID();
  const pending = new Map();
  const media = [...document.querySelectorAll('audio,video')];
  const frame = document.querySelector('iframe');
  let lastPlayError = null;
  let trustedPlayClicks = 0;
  let churnRoot = null;
  let churnRound = 0;
  function read() {
    const button = document.getElementById('start-media').getBoundingClientRect();
    return { node, instanceId, revision, origin: location.origin, trustedPlayClicks,
      churn: { round: churnRound, connected: churnRoot?.isConnected === true, elementCount: 11 },
      playButton: { x: button.left + button.width / 2, y: button.top + button.height / 2 },
      media: media.map(element => ({ kind: element.localName, paused: element.paused,
        volume: element.volume, muted: element.muted, currentTime: element.currentTime,
        readyState: element.readyState, ended: element.ended })), lastPlayError };
  }
  async function request(command = 'inspect') {
    // The browser owner's main-document readiness may precede child navigation.
    // Wait for this fixture's actual descendant load before posting a request.
    if (document.readyState !== 'complete') await new Promise((resolve, reject) => {
      const loaded = () => { clearTimeout(timer); resolve(); };
      const timer = setTimeout(() => {
        window.removeEventListener('load', loaded); reject(new Error('FRAME_FIXTURE_LOAD_TIMEOUT'));
      }, 8000);
      window.addEventListener('load', loaded, { once: true });
    });
    if (command === 'play') {
      const results = await Promise.allSettled(media.map(element => element.play()));
      const rejected = results.find(result => result.status === 'rejected');
      lastPlayError = rejected ? String(rejected.reason?.name || rejected.reason).slice(0, 200) : null;
    }
    if (node !== 'top' && command === 'churn-add') {
      if (churnRoot) throw new Error('FRAME_FIXTURE_CHURN_ALREADY_ATTACHED');
      // One native MutationObserver batch deliberately contains overlapping
      // parent/child additions. No text nodes, shadow roots or sources vary it.
      churnRoot = document.createElement('section');
      churnRoot.hidden = true;
      document.body.append(churnRoot);
      const branch = document.createElement('div');
      churnRoot.append(branch);
      for (let index = 0; index < 8; index += 1) branch.append(document.createElement('span'));
      branch.append(document.createElement('video'));
      churnRound += 1;
    }
    if (node !== 'top' && command === 'churn-remove') {
      if (!churnRoot) throw new Error('FRAME_FIXTURE_CHURN_NOT_ATTACHED');
      churnRoot.remove(); churnRoot = null;
    }
    const descendants = frame ? await new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('FRAME_FIXTURE_REPLY_TIMEOUT')); }, 2500);
      pending.set(id, { resolve, timer });
      frame.contentWindow.postMessage({ channel: 'entropy-media-frame-fixture', token, id, command }, childOrigin);
    }) : [];
    const rect = frame?.getBoundingClientRect();
    return [read(), ...descendants.map(item => ({ ...item,
      playButton: { x: item.playButton.x + rect.left + frame.clientLeft,
        y: item.playButton.y + rect.top + frame.clientTop } }))];
  }
  window.addEventListener('message', async event => {
    const data = event.data;
    if (!data || data.channel !== 'entropy-media-frame-fixture' || data.token !== token) return;
    if (frame && event.source === frame.contentWindow && event.origin === childOrigin && Array.isArray(data.result)) {
      const entry = pending.get(data.id);
      if (entry) { pending.delete(data.id); clearTimeout(entry.timer); entry.resolve(data.result); }
      return;
    }
    if (event.source !== window.parent || event.origin !== parentOrigin
      || !['play', 'inspect', 'churn-add', 'churn-remove'].includes(data.command)) return;
    try {
      const result = await request(data.command);
      event.source.postMessage({ channel: data.channel, token, id: data.id, result }, event.origin);
    } catch (error) { lastPlayError = String(error.message).slice(0, 200); }
  });
  window.__entropyFrameHoldFixture = {
    request, read,
    async navigateChild() {
      if (!frame) throw new Error('FRAME_FIXTURE_CHILD_REQUIRED');
      const url = new URL(frame.src); url.searchParams.set('revision', String(Number(revision) + 1));
      await new Promise((resolve, reject) => {
        const loaded = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => {
          frame.removeEventListener('load', loaded); reject(new Error('FRAME_FIXTURE_NAVIGATION_TIMEOUT'));
        }, 8000);
        frame.addEventListener('load', loaded, { once: true }); frame.src = url.href;
      });
      return { origin: url.origin, revision: url.searchParams.get('revision') };
    },
  };
  const startButton = document.getElementById('start-media');
  startButton.addEventListener('click', event => {
    if (event.isTrusted) trustedPlayClicks += 1;
    request('play').catch(error => { lastPlayError = error.message; });
  });
  // Video may autoplay; audio readiness uses the protocol's real button input.
  for (const element of media) element.play().catch(error => { lastPlayError = error.name; });
}

function createTone() {
  const rate = 8000;
  const samples = rate * 4;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(1000 * Math.sin(i * Math.PI * 440 / rate)), 44 + i * 2);
  return wav;
}

export function renderMediaFrameHoldFixture({ index, port, token, revision = '1' }) {
  if (!Number.isInteger(index) || index < 0 || index >= MEDIA_FRAME_HOLD_HOSTS.length) throw new Error('QA_FRAME_FIXTURE_INDEX_INVALID');
  const origin = i => `http://${MEDIA_FRAME_HOLD_HOSTS[i]}:${port}`;
  const childOrigin = index < 2 ? origin(index + 1) : null;
  const config = { node: ['top', 'child', 'nested'][index], childOrigin,
    parentOrigin: index > 0 ? origin(index - 1) : null, token, revision };
  return `<!doctype html><meta charset="utf-8"><title>Media frame hold QA</title>
<button id="start-media" style="position:fixed;top:8px;left:8px;width:160px;height:40px;z-index:10">Play native media</button>
<h1>${config.node} native media</h1>
<audio src="/tone.wav" muted loop preload="auto"></audio>
<video src="/tone.wav" muted loop playsinline preload="auto" width="280" height="100"></video>
${childOrigin ? `<iframe title="${index ? 'nested' : 'child'} media" allow="autoplay" src="${childOrigin}/?revision=${encodeURIComponent(revision)}" width="560" height="440"></iframe>` : ''}
<script>(${nativeMediaFixture.toString()})(${JSON.stringify(config).replaceAll('<', '\\u003c')});</script>`;
}

export async function createMediaFrameHoldFixture() {
  const token = randomUUID();
  const audio = createTone();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const index = MEDIA_FRAME_HOLD_HOSTS.indexOf(url.hostname);
    if (index < 0) { response.writeHead(403); response.end(); return; }
    response.writeHead(200, { 'Content-Type': url.pathname === '/tone.wav' ? 'audio/wav' : 'text/html; charset=utf-8',
      'Cache-Control': 'no-store' });
    response.end(url.pathname === '/tone.wav' ? audio : renderMediaFrameHoldFixture({ index,
      port: server.address().port, token, revision: url.searchParams.get('revision') || '1' }));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://${MEDIA_FRAME_HOLD_HOSTS[0]}:${server.address().port}/`,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve({ closed: true })); server.closeAllConnections();
    }) };
}

export function requireNativeFrameMediaEvidence(snapshot, { paused, nodes = ['top', 'child', 'nested'] }) {
  if (!Array.isArray(snapshot) || new Set(snapshot.map(item => item.node)).size !== snapshot.length) {
    throw new Error('QA_MEDIA_FRAME_HOLD_EVIDENCE_INVALID');
  }
  for (const node of nodes) {
    const item = snapshot.find(entry => entry.node === node);
    if (!item?.instanceId || !Array.isArray(item.media) || item.media.length !== 2
      || item.media.some(media => media.paused !== paused || media.readyState < 2
        || !Number.isFinite(media.currentTime) || media.volume !== 1 || media.muted !== true)) {
      throw new Error(`QA_MEDIA_FRAME_HOLD_NATIVE_STATE:${node}:${paused ? 'paused' : 'playing'}`);
    }
  }
  return snapshot;
}
