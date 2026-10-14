import { createZenArtifactWorkerClient } from './ZenArtifactWorkerClient.js';
import { getZenArtifactGalleryGeometry, resolveZenArtifactGalleryResolution } from '../../presentation/artifacts/engine/zenArtifactGalleryGeometry.js';

// Dashboard reservation and mounted canvas adopt the same logical channel.
// No timer, mirror cache, or second renderer is owned by this UI seam.
let retained = 0, record = null;
const releaseUnused = () => {
  if (record && retained === 0 && !record.host && record.groundHosts.size === 0) { record.client.dispose(); record = null; }
};
function requireClient(devicePixelRatio) {
  const resolution = resolveZenArtifactGalleryResolution(devicePixelRatio).effectivePixelRatio;
  if (record && record.resolution !== resolution) {
    if (record.host || record.groundHosts.size) throw new Error('ZEN_ARTIFACT_ACTIVE_RESOLUTION_CHANGE');
    record.client.dispose(); record = null;
  }
  if (!record) {
    const entry = { client: null, resolution, host: null, groundHosts: new Set(), failure: null, warmup: null };
    entry.client = createZenArtifactWorkerClient({ devicePixelRatio, onError: error => {
      entry.failure = error; entry.host?.onError(error);
      for (const groundHost of entry.groundHosts) groundHost.onError(error);
    } });
    record = entry;
  }
  if (record.failure) throw record.failure;
  return record;
}
export function retainZenArtifactGallerySession() {
  retained += 1;
  let released = false;
  return {
    async prepare({ nightDepth, devicePixelRatio }) {
      if (released) throw new Error('ZEN_ARTIFACT_GALLERY_RESERVATION_RELEASED');
      // An attached host owns live DPR changes and its replacement generation.
      if (record?.host) return { status: 'adopted' };
      const entry = requireClient(devicePixelRatio);
      if (!entry.warmup) entry.warmup = entry.client.prepareFrame({ id: 'shoji', nightDepth }, {
        origin: getZenArtifactGalleryGeometry('lens').origin, animate: false, presentation: null,
      }).then(ticket => {
        // A real representative frame warms batch + projective programs. The
        // unshown bitmap is closed; scene/textures remain in their sole cache.
        if (!entry.host && record === entry) entry.client.pause();
        return { status: ticket.status === 'prepared' ? 'prepared' : 'superseded' };
      });
      return entry.warmup;
    },
    release() { if (released) return; released = true; retained -= 1; releaseUnused(); },
  };
}
export function acquireZenArtifactGalleryClient({ canvas, devicePixelRatio, onError }) {
  const entry = requireClient(devicePixelRatio);
  if (entry.host) throw new Error('ZEN_ARTIFACT_GALLERY_ALREADY_MOUNTED');
  const host = { onError }; entry.host = host;
  try { entry.client.attachCanvas(canvas); }
  catch (error) { entry.host = null; releaseUnused(); throw error; }
  return { ...entry.client, dispose() {
    if (entry.host !== host) return;
    entry.client.detachCanvas(); entry.host = null; releaseUnused();
  } };
}

// The raked karesansui ground renders on the same artifact channel. It is a
// static frame, so the host keeps at most one request in flight and one queued:
// a newer request replaces the queued one (resolved as superseded), and the
// worker never renders a frame nobody will show.
export function acquireZenKaresansuiGroundRenderer({ devicePixelRatio, onError }) {
  const entry = requireClient(devicePixelRatio);
  const host = { onError };
  entry.groundHosts.add(host);
  let disposed = false, inFlight = false, queued = null;
  const pump = () => {
    if (inFlight || !queued || disposed) return;
    const task = queued; queued = null; inFlight = true;
    entry.client.renderGround(task.request).then(bitmap => {
      if (disposed) { bitmap.close(); task.resolve({ status: 'superseded' }); return; }
      task.resolve({ status: 'rendered', bitmap, key: task.request.key });
    }, task.reject).finally(() => { inFlight = false; pump(); });
  };
  return {
    render(request) {
      if (disposed) return Promise.reject(new Error('ZEN_KARESANSUI_GROUND_HOST_DISPOSED'));
      if (entry.failure) return Promise.reject(entry.failure);
      queued?.resolve({ status: 'superseded' });
      return new Promise((resolve, reject) => { queued = { request, resolve, reject }; pump(); });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      queued?.resolve({ status: 'superseded' }); queued = null;
      entry.groundHosts.delete(host);
      if (record === entry) releaseUnused();
    },
  };
}
