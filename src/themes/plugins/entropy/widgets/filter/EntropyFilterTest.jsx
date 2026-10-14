import React from 'react';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';

const ENTROPY_PALETTE = Object.freeze({
  bg: '#06070b',
  surface: 'rgba(17, 11, 15, 0.82)',
  surfaceAlt: 'rgba(14, 9, 13, 0.86)',
  border: 'rgba(255, 96, 132, 0.34)',
  borderSubtle: 'rgba(255, 96, 132, 0.18)',
  text: '#fde7ed',
  textMuted: '#c39ba7',
  textFaint: 'rgba(195, 155, 167, 0.5)',
  accent: '#ff4f7c',
  accentSoft: 'rgba(255, 79, 124, 0.26)',
  accentDark: '#2a050f',
  btnBg: 'rgba(255, 79, 124, 0.22)',
  btnText: '#ffe6ee',
  btnActiveBg: 'rgba(119, 62, 76, 0.38)',
  btnActiveText: '#d0aeb8',
  badge: 'ENTROPY',
  gridPattern: 'linear-gradient(90deg, rgba(255,79,124,0.14) 1px, transparent 1px), linear-gradient(0deg, rgba(255,79,124,0.12) 1px, transparent 1px)',
  gridSize: '20px 20px',
  gridOpacity: 0.24,
  glow: 'radial-gradient(ellipse at 15% -8%, rgba(255,79,124,0.08), transparent 45%)',
  mediaOverlay: 'linear-gradient(160deg, rgba(255, 79, 124, 0.18), rgba(10, 3, 6, 0.25))',
});

const ENTROPY_COPY = Object.freeze({
  title: 'Entropy Intervention Lab',
  subtitle: 'Industrial Friction Runtime',
  onboarding: 'Adjust friction filters on the right. This feed shows every effect in real time.',
  footer: 'BUFFER // CONTINUOUS MEASUREMENT ACTIVE',

  author: 'entropy.core',
  handle: '@entropy_runtime',
  timeAgo: '2h',
  postCaption: 'Protocol baseline: controlled interference, stable readability.',
  bodyFallback: 'This entropy scene is tuned for filter verification across blur, contrast, saturation, and text mutation without motivational messaging.',

  likes: '4,208',
  comments: '196',
  shares: '842',
  views: '18K',
  textPostTimeAgo: '6h',
  textPostLikes: '1,024',
  textPostComments: '67',

  inputLabel: 'Command Input Stream',
  inputHint: 'Validate type-to-render latency under active friction rules.',
  inputPlaceholder: 'route://input-buffer/alpha',
  clickLabel: 'Execution Relay',
  clickHint: 'Queue click actions and observe release timing precision.',
  clickIdle: 'Execute',
  clickPending: 'Processing',
  clickMetric: 'Relay Cycles',
});

export default function EntropyFilterTest({ variant, baseText, sourceText, settings, hiddenMetrics, platformId }) {
  return (
    <ThemeFilterTestScaffold
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      settings={settings}
      hiddenMetrics={hiddenMetrics}
      platformId={platformId}
      palette={ENTROPY_PALETTE}
      copy={ENTROPY_COPY}
      layoutVariant="console"
    />
  );
}
