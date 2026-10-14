import { VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID, getVideoSkipMediaSourceFingerprint } from './videoSkipMainWorldActuator.js';

export const VIDEO_SKIP_MEDIA_ADAPTER_IDS = Object.freeze({
  NATIVE_VIDEO: 'native_video',
  YOUTUBE_PLAYER: VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID,
});

export const VIDEO_SKIP_MEDIA_TARGET_ATTRIBUTE = 'data-friction-video-skip-media-token';
const pendingMediaTargets = new WeakMap();

export function releaseVideoSkipMediaTarget(video) {
  const token = pendingMediaTargets.get(video);
  if (!token) return;
  if (video.getAttribute(VIDEO_SKIP_MEDIA_TARGET_ATTRIBUTE) === token) {
    video.removeAttribute(VIDEO_SKIP_MEDIA_TARGET_ATTRIBUTE);
  }
  pendingMediaTargets.delete(video);
}

function normalizeHostname(hostname) {
  const value = String(hostname || '').trim().toLowerCase();
  if (!value) throw new Error('VIDEO_SKIP_MEDIA_ADAPTER_HOSTNAME_REQUIRED');
  return value;
}

function isYouTubeHostname(hostname) {
  return hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
}

function createYouTubeAdapter(video, actuator) {
  const source = video.currentSrc;
  const declaredSource = video.getAttribute('src');
  const execute = async (command, target) => {
    if (!video.isConnected || video.currentSrc !== source || video.getAttribute('src') !== declaredSource) {
      throw new Error('VIDEO_SKIP_MEDIA_TARGET_STALE');
    }
    const existing = video.getAttribute(VIDEO_SKIP_MEDIA_TARGET_ATTRIBUTE);
    if (existing && existing !== pendingMediaTargets.get(video)) {
      throw new Error('VIDEO_SKIP_MEDIA_TARGET_ATTRIBUTE_CONFLICT');
    }
    const token = `${globalThis.crypto.randomUUID()}:${getVideoSkipMediaSourceFingerprint(video)}`;
    pendingMediaTargets.set(video, token);
    video.setAttribute(VIDEO_SKIP_MEDIA_TARGET_ATTRIBUTE, token);
    try {
      const result = command === 'seek'
        ? await actuator.seek(target, token)
        : await actuator.play(token);
      if (!video.isConnected || video.currentSrc !== source || video.getAttribute('src') !== declaredSource
        || pendingMediaTargets.get(video) !== token) {
        throw new Error('VIDEO_SKIP_MEDIA_TARGET_STALE');
      }
      return result;
    } finally {
      if (pendingMediaTargets.get(video) === token) releaseVideoSkipMediaTarget(video);
    }
  };
  return Object.freeze({
    id: VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID,
    verifyPosition: true,
    seek(target) {
      return execute('seek', target);
    },
    play() {
      return execute('play');
    },
  });
}

function createNativeAdapter(video) {
  return Object.freeze({
    id: VIDEO_SKIP_MEDIA_ADAPTER_IDS.NATIVE_VIDEO,
    verifyPosition: true,
    seek(target) {
      video.currentTime = target;
      return true;
    },
    play() {
      if (typeof video.play !== 'function') {
        throw new Error('VIDEO_SKIP_NATIVE_VIDEO_PLAY_UNAVAILABLE');
      }
      return video.play();
    },
  });
}

export function resolveVideoSkipMediaAdapter({
  video,
  hostname,
  youtubeActuator = null,
} = {}) {
  if (!video || typeof video !== 'object') {
    throw new Error('VIDEO_SKIP_MEDIA_ADAPTER_VIDEO_REQUIRED');
  }
  const normalizedHostname = normalizeHostname(hostname);
  if (!isYouTubeHostname(normalizedHostname)) {
    return Object.freeze({
      ok: true,
      adapter: createNativeAdapter(video),
    });
  }

  if (
    !youtubeActuator
    || typeof youtubeActuator.seek !== 'function'
    || typeof youtubeActuator.play !== 'function'
  ) {
    return Object.freeze({
      ok: false,
      adapterId: VIDEO_SKIP_MEDIA_ADAPTER_IDS.YOUTUBE_PLAYER,
      reason: 'youtube_player_unavailable',
      hasActuator: !!youtubeActuator,
      hasSeek: typeof youtubeActuator?.seek === 'function',
      hasPlay: typeof youtubeActuator?.play === 'function',
    });
  }

  return Object.freeze({
    ok: true,
    adapter: createYouTubeAdapter(video, youtubeActuator),
  });
}
