import React from 'react';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';

const SIGNAL_PALETTE = Object.freeze({
  bg: 'var(--color-background)',
  surface: 'color-mix(in srgb, var(--color-surface-elevated) 86%, transparent)',
  surfaceAlt: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
  border: 'color-mix(in srgb, var(--color-accent) 34%, transparent)',
  borderSubtle: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
  text: 'var(--color-text)',
  textMuted: 'var(--color-on-surface-muted)',
  textFaint: 'color-mix(in srgb, var(--color-on-surface-muted) 55%, transparent)',
  accent: 'var(--color-accent)',
  accentSoft: 'color-mix(in srgb, var(--color-accent) 22%, transparent)',
  accentDark: 'color-mix(in srgb, var(--color-accent) 18%, black)',
  btnBg: 'color-mix(in srgb, var(--color-accent) 18%, transparent)',
  btnText: 'var(--color-text)',
  btnActiveBg: 'color-mix(in srgb, var(--color-border) 55%, transparent)',
  btnActiveText: 'var(--color-on-surface-muted)',
  badge: 'ENTROPY LAB',
  gridPattern: 'linear-gradient(90deg, color-mix(in srgb, var(--color-accent) 14%, transparent) 1px, transparent 1px), linear-gradient(0deg, color-mix(in srgb, var(--color-accent) 12%, transparent) 1px, transparent 1px)',
  gridSize: '20px 20px',
  gridOpacity: 0.24,
  glow: 'radial-gradient(ellipse at 18% -8%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 45%)',
  mediaOverlay: 'linear-gradient(160deg, color-mix(in srgb, var(--color-accent) 16%, transparent), color-mix(in srgb, var(--color-surface-sunken) 60%, transparent))',
});

const SIGNAL_COPY = Object.freeze({
  title: 'Entropy Filter Validation Lab',
  subtitle: 'Core Effect Test Surface',
  onboarding: 'Adjust filters on the right. Every effect is reflected here in real time.',
  footer: 'LAB BUFFER // CONTINUOUS VERIFICATION',

  author: 'signal.core',
  handle: '@entropy_lab',
  timeAgo: '1h',
  postCaption: 'Filter baseline sentence for distortion and clarity checks.',
  bodyFallback: 'This default lab view validates every active filter in one controlled scene — visual, textual, social, and latency metrics all observable simultaneously.',

  likes: '3,072',
  comments: '164',
  shares: '728',
  views: '14K',
  textPostTimeAgo: '5h',
  textPostLikes: '1,408',
  textPostComments: '82',

  inputLabel: 'Input Delay Channel',
  inputHint: 'Type a sequence and compare live input against delayed rendering.',
  inputPlaceholder: 'lab://type-sequence',
  clickLabel: 'Action Delay Queue',
  clickHint: 'Dispatch interactions and verify queued trigger release.',
  clickIdle: 'Dispatch',
  clickPending: 'Queued',
  clickMetric: 'Executed',
});

export default function SignalCalibration({ variant, baseText, sourceText, settings, hiddenMetrics, platformId }) {
  return (
    <ThemeFilterTestScaffold
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      settings={settings}
      hiddenMetrics={hiddenMetrics}
      platformId={platformId}
      palette={SIGNAL_PALETTE}
      copy={SIGNAL_COPY}
      layoutVariant="console"
    />
  );
}
