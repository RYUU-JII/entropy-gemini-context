import React from 'react';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';

const ZEN_PALETTE = Object.freeze({
  bg: '#f4f1ea',
  surface: 'rgba(255, 252, 246, 0.85)',
  surfaceAlt: 'rgba(251, 246, 238, 0.94)',
  border: 'rgba(125, 102, 78, 0.3)',
  borderSubtle: 'rgba(125, 102, 78, 0.16)',
  text: '#3d3024',
  textMuted: '#7f6651',
  textFaint: 'rgba(127, 102, 81, 0.5)',
  accent: '#9a6a3c',
  accentSoft: 'rgba(154, 106, 60, 0.2)',
  accentDark: '#23170d',
  btnBg: 'rgba(154, 106, 60, 0.18)',
  btnText: '#4a2f18',
  btnActiveBg: 'rgba(156, 139, 117, 0.32)',
  btnActiveText: '#635446',
  badge: 'ZEN',
  gridPattern: 'linear-gradient(90deg, rgba(125,102,78,0.08) 1px, transparent 1px), linear-gradient(0deg, rgba(125,102,78,0.08) 1px, transparent 1px)',
  gridSize: '22px 22px',
  gridOpacity: 0.12,
  glow: 'radial-gradient(ellipse at 50% -5%, rgba(154,106,60,0.06), transparent 50%)',
  mediaOverlay: 'linear-gradient(160deg, rgba(154, 106, 60, 0.16), rgba(255, 252, 246, 0.12))',
});

const ZEN_COPY = Object.freeze({
  title: 'Zen Filter Garden',
  subtitle: 'Quiet Runtime Calibration',
  onboarding: 'Adjust filters gently on the right. Effects appear in this garden view.',
  footer: 'SAND TRACE // CONTINUOUS FLOW',

  author: 'garden.keeper',
  handle: '@zen_garden',
  timeAgo: '3h',
  postCaption: 'Calm baseline sentence for shuffle and blur validation.',
  bodyFallback: 'Zen mode favors restrained contrast and natural texture while preserving a measurable baseline for all friction filters.',

  likes: '2,048',
  comments: '108',
  shares: '412',
  views: '8.4K',
  textPostTimeAgo: '7h',
  textPostLikes: '864',
  textPostComments: '42',

  inputLabel: 'Calligraphy Input',
  inputHint: 'Observe ink-like delay between gesture and final stroke.',
  inputPlaceholder: 'brush://quiet-line',
  clickLabel: 'Ripple Action',
  clickHint: 'Release actions like stones on still water.',
  clickIdle: 'Cast',
  clickPending: 'Rippling',
  clickMetric: 'Stones',
});

export default function ZenFilterTest({ variant, baseText, sourceText, settings, hiddenMetrics, platformId }) {
  return (
    <ThemeFilterTestScaffold
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      settings={settings}
      hiddenMetrics={hiddenMetrics}
      platformId={platformId}
      palette={ZEN_PALETTE}
      copy={ZEN_COPY}
      layoutVariant="editorial"
    />
  );
}
