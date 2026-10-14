// SCP materials project the installed theme tokens; family accents arrive through
// artifactRenderContext and never substitute another theme's palette.
export const SCP_ARTIFACT_PALETTE = Object.freeze({
  charcoal: 'var(--color-surface)',
  recess: 'var(--color-surface-sunken)',
  steel: 'color-mix(in srgb, var(--color-on-surface) 30%, var(--color-surface))',
  steelEdge: 'color-mix(in srgb, var(--color-on-surface) 12%, var(--color-border-strong))',
  brushed: 'color-mix(in srgb, var(--color-on-surface) 56%, var(--color-surface))',
  ivory: 'color-mix(in srgb, var(--color-on-surface) 92%, var(--color-warning-muted))',
  paperEdge: 'color-mix(in srgb, var(--color-on-surface) 60%, var(--color-warning-muted))',
  ink: 'var(--color-background)',
  muted: 'var(--color-on-surface-muted)',
  amber: 'color-mix(in srgb, var(--color-warning) 68%, var(--color-accent-tertiary))',
  warning: 'var(--color-danger)',
});
