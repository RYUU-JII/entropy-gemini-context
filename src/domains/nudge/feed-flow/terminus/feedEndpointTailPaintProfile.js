export const FEED_ENDPOINT_TAIL_PAINT_PROFILE_VERSION =
  'feed-endpoint-tail-paint-v1';

export const FEED_ENDPOINT_TAIL_PAINT_MODES = Object.freeze({
  INHERITED_OPAQUE: 'inherited_opaque',
  TRANSPARENT_NATIVE_BLEED: 'transparent_native_bleed',
});

const PROFILES = Object.freeze({
  continuous: Object.freeze({
    version: FEED_ENDPOINT_TAIL_PAINT_PROFILE_VERSION,
    surfaceMode: 'continuous',
    mode: FEED_ENDPOINT_TAIL_PAINT_MODES.INHERITED_OPAQUE,
  }),
  paged: Object.freeze({
    version: FEED_ENDPOINT_TAIL_PAINT_PROFILE_VERSION,
    surfaceMode: 'paged',
    mode: FEED_ENDPOINT_TAIL_PAINT_MODES.TRANSPARENT_NATIVE_BLEED,
  }),
});

// Computed sRGB paint is normalized here, rather than trusting a media lane's
// inherited (often black-on-black) color. This is presentation, not site identity.
export function resolveFeedEndpointReadableInk(backgroundColor) {
  const match = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(backgroundColor);
  if (!match || (match[4] !== undefined && Number(match[4]) !== 1)) {
    throw new Error('FEED_ENDPOINT_OPAQUE_SRGB_PAINT_REQUIRED');
  }
  const channels = match.slice(1, 4).map(Number);
  if (channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) {
    throw new Error('FEED_ENDPOINT_SRGB_CHANNEL_INVALID');
  }
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  // Pick the higher-contrast neutral; the surface owns its quieter secondary text.
  return luminance > 0.179 ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
}

export function resolveFeedEndpointTailPaintProfile({
  surfaceMode = 'unknown',
} = {}) {
  const profile = PROFILES[surfaceMode];
  if (!profile) {
    throw new Error(
      `FEED_ENDPOINT_TAIL_PAINT_PROFILE_UNSUPPORTED:${String(surfaceMode)}`,
    );
  }
  return profile;
}

export function validateFeedEndpointTailPaintProfile(profile) {
  const expected = PROFILES[profile?.surfaceMode];
  if (
    !expected
    || profile?.version !== FEED_ENDPOINT_TAIL_PAINT_PROFILE_VERSION
    || profile.mode !== expected.mode
  ) {
    throw new Error('FEED_ENDPOINT_TAIL_PAINT_PROFILE_INVALID');
  }
  return profile;
}
