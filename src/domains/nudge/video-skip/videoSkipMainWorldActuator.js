export const VIDEO_SKIP_MAIN_WORLD_COMMANDS = Object.freeze({
  SEEK: 'seek',
  PLAY: 'play',
});

export const VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID = 'youtube_player';

export function getVideoSkipMediaSourceFingerprint(video) {
  const source = `${video.currentSrc}\n${video.getAttribute('src')}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const RESULT_FAILURE_REASONS = new Set([
  'request_invalid',
  'origin_mismatch',
  'player_unavailable',
  'seek_unavailable',
  'play_unavailable',
  'command_failed',
  'media_target_unavailable',
  'media_target_mismatch',
]);

function createContractError(code, field = '') {
  const error = new Error(field ? `${code}:${field}` : code);
  error.code = code;
  if (field) error.field = field;
  return error;
}

function normalizeCommand(command) {
  if (command === VIDEO_SKIP_MAIN_WORLD_COMMANDS.SEEK) return command;
  if (command === VIDEO_SKIP_MAIN_WORLD_COMMANDS.PLAY) return command;
  throw createContractError('VIDEO_SKIP_MAIN_WORLD_COMMAND_INVALID', 'command');
}

export function createVideoSkipMainWorldCommandRequest({ command, targetTime, mediaToken } = {}) {
  const normalizedCommand = normalizeCommand(command);
  if (typeof mediaToken !== 'string' || !/^[a-f0-9-]{36}:[a-f0-9]{8}$/i.test(mediaToken)) {
    throw createContractError('VIDEO_SKIP_MAIN_WORLD_MEDIA_TOKEN_INVALID', 'mediaToken');
  }
  if (normalizedCommand === VIDEO_SKIP_MAIN_WORLD_COMMANDS.SEEK) {
    const normalizedTargetTime = Number(targetTime);
    if (!Number.isFinite(normalizedTargetTime) || normalizedTargetTime < 0) {
      throw createContractError('VIDEO_SKIP_MAIN_WORLD_TARGET_TIME_INVALID', 'targetTime');
    }
    return Object.freeze({
      command: normalizedCommand,
      targetTime: normalizedTargetTime,
      mediaToken,
    });
  }
  if (targetTime !== undefined) {
    throw createContractError('VIDEO_SKIP_MAIN_WORLD_TARGET_TIME_FORBIDDEN', 'targetTime');
  }
  return Object.freeze({ command: normalizedCommand, mediaToken });
}

export function requireVideoSkipMainWorldActuatorResult(value, {
  expectedCommand = null,
} = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createContractError('VIDEO_SKIP_MAIN_WORLD_RESULT_INVALID', 'result');
  }
  const command = normalizeCommand(value.command);
  if (expectedCommand !== null && command !== normalizeCommand(expectedCommand)) {
    throw createContractError('VIDEO_SKIP_MAIN_WORLD_RESULT_INVALID', 'command');
  }
  if (value.adapterId !== VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID) {
    throw createContractError('VIDEO_SKIP_MAIN_WORLD_RESULT_INVALID', 'adapterId');
  }
  if (typeof value.ok !== 'boolean') {
    throw createContractError('VIDEO_SKIP_MAIN_WORLD_RESULT_INVALID', 'ok');
  }
  if (value.ok === true) {
    if (value.reason !== null) {
      throw createContractError('VIDEO_SKIP_MAIN_WORLD_RESULT_INVALID', 'reason');
    }
    return Object.freeze({
      ok: true,
      command,
      adapterId: VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID,
      reason: null,
    });
  }
  if (!RESULT_FAILURE_REASONS.has(value.reason)) {
    throw createContractError('VIDEO_SKIP_MAIN_WORLD_RESULT_INVALID', 'reason');
  }
  return Object.freeze({
    ok: false,
    command,
    adapterId: VIDEO_SKIP_MAIN_WORLD_ADAPTER_ID,
    reason: value.reason,
  });
}

// This function is serialized by the MV3 scripting owner. Keep it fully
// self-contained: imported bindings and module-level constants are unavailable
// in the target page's MAIN world.
export function executeVideoSkipYouTubeCommandInMainWorld(request) {
  const adapterId = 'youtube_player';
  const command = request?.command === 'play' ? 'play' : 'seek';
  const fail = (reason) => ({
    ok: false,
    command,
    adapterId,
    reason,
  });

  try {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
      return fail('request_invalid');
    }
    if (request.command !== 'seek' && request.command !== 'play') {
      return fail('request_invalid');
    }
    const expectedHostname = typeof request.expectedHostname === 'string'
      ? request.expectedHostname.trim().toLowerCase()
      : '';
    const actualHostname = String(globalThis.location?.hostname || '').trim().toLowerCase();
    const isYouTubeHost = actualHostname === 'youtube.com'
      || actualHostname.endsWith('.youtube.com');
    if (!expectedHostname || !isYouTubeHost || actualHostname !== expectedHostname) {
      return fail('origin_mismatch');
    }

    if (typeof request.mediaToken !== 'string' || !/^[a-f0-9-]{36}:[a-f0-9]{8}$/i.test(request.mediaToken)) {
      return fail('request_invalid');
    }
    const candidates = globalThis.document.querySelectorAll(
      `video[data-friction-video-skip-media-token="${request.mediaToken}"]`,
    );
    if (candidates.length !== 1 || !candidates[0].isConnected) return fail('media_target_unavailable');
    const video = candidates[0];
    const source = `${video.currentSrc}\n${video.getAttribute('src')}`;
    let sourceHash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      sourceHash = Math.imul(sourceHash ^ source.charCodeAt(index), 16777619);
    }
    const fingerprint = (sourceHash >>> 0).toString(16).padStart(8, '0');
    if (request.mediaToken.slice(-8) !== fingerprint) return fail('media_target_mismatch');
    const player = video.closest('#movie_player, .html5-video-player');
    if (!player) return fail('player_unavailable');
    const playerVideos = player.querySelectorAll('video');
    if (playerVideos.length !== 1 || playerVideos[0] !== video) return fail('media_target_mismatch');

    if (request.command === 'seek') {
      const targetTime = Number(request.targetTime);
      if (!Number.isFinite(targetTime) || targetTime < 0) return fail('request_invalid');
      if (typeof player.seekTo !== 'function') return fail('seek_unavailable');
      player.seekTo(targetTime, true);
      return {
        ok: true,
        command: 'seek',
        adapterId,
        reason: null,
      };
    }

    if (Object.prototype.hasOwnProperty.call(request, 'targetTime')) {
      return fail('request_invalid');
    }
    if (typeof player.playVideo !== 'function') return fail('play_unavailable');
    player.playVideo();
    return {
      ok: true,
      command: 'play',
      adapterId,
      reason: null,
    };
  } catch (_error) {
    return fail('command_failed');
  }
}
