export const ZEN_PRESSURE_COLORS = Object.freeze({
  stoneDark: '#555A49',
  protected: '#936F62',
  allowed: '#68755F',
  unmanaged: '#85806E',
  recommended: '#AA916B',
  other: '#B7AB90',
});

export const ZEN_PRESSURE_FRAME = Object.freeze({
  fill: 'var(--zen-ambient-layer-l3-bottom)',
  divider: 'var(--zen-ambient-edge)',
  ink: 'var(--zen-ambient-text-muted)',
  focus: 'var(--zen-ambient-primary)',
});

// The lower rail continues the ivory frame; policy pigment belongs to the
// domain currently being explored, rather than to the whole frame.
export const ZEN_PRESSURE_FRAME_STYLE = Object.freeze({
  '--zen-pressure-frame-fill': ZEN_PRESSURE_FRAME.fill,
  '--zen-pressure-frame-divider': ZEN_PRESSURE_FRAME.divider,
  '--zen-pressure-frame-ink': ZEN_PRESSURE_FRAME.ink,
  '--zen-pressure-frame-focus': ZEN_PRESSURE_FRAME.focus,
});

const TONES_BY_DISPOSITION = Object.freeze({
  protected: Object.freeze({
    id: 'protected',
    base: ZEN_PRESSURE_COLORS.protected,
    labelKey: 'target_protocol.site_policy_protected',
    fallbackLabel: 'Protected',
  }),
  managed_allowed: Object.freeze({
    id: 'allowed',
    base: ZEN_PRESSURE_COLORS.allowed,
    labelKey: 'target_protocol.site_policy_allowed',
    fallbackLabel: 'Allowed',
  }),
  recommended: Object.freeze({
    id: 'recommended',
    base: ZEN_PRESSURE_COLORS.recommended,
    labelKey: 'target_protocol.site_policy_recommended',
    fallbackLabel: 'Review',
  }),
  unmanaged: Object.freeze({
    id: 'unmanaged',
    base: ZEN_PRESSURE_COLORS.unmanaged,
    labelKey: 'target_protocol.site_policy_unmanaged',
    fallbackLabel: 'Unmanaged',
  }),
});

export function resolveZenPressureTone(policyDisposition) {
  const tone = TONES_BY_DISPOSITION[policyDisposition];
  if (!tone) {
    throw new Error(`ZEN_PRESSURE_POLICY_DISPOSITION_INVALID:${String(policyDisposition || '')}`);
  }
  return tone;
}

export function resolveZenPressureInteractionFill(tone, selected = false) {
  const semanticWeight = selected ? 52 : 46;
  return `color-mix(in srgb, ${tone} ${semanticWeight}%, ${ZEN_PRESSURE_FRAME.fill})`;
}

// At rest the quantitative allocation is a quiet part of the frame. Pressure
// share controls width only, never darkness or an invented policy intensity.
export function resolveZenPressureRestFill(_tone, pressureShare) {
  if (!Number.isFinite(pressureShare) || pressureShare < 0 || pressureShare > 1) {
    throw new Error('ZEN_PRESSURE_PAINT_SHARE_INVALID');
  }
  return ZEN_PRESSURE_FRAME.fill;
}
