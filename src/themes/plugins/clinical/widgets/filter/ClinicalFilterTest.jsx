import React from 'react';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';

const CLINICAL_PALETTE = Object.freeze({
  bg: '#f4f7fb',
  surface: 'rgba(255, 255, 255, 0.9)',
  surfaceAlt: 'rgba(248, 251, 255, 0.96)',
  border: 'rgba(100, 131, 165, 0.35)',
  borderSubtle: 'rgba(100, 131, 165, 0.18)',
  text: '#13263f',
  textMuted: '#5f7390',
  textFaint: 'rgba(95, 115, 144, 0.5)',
  accent: '#2f80ed',
  accentSoft: 'rgba(47, 128, 237, 0.18)',
  accentDark: '#08182e',
  btnBg: 'rgba(47, 128, 237, 0.15)',
  btnText: '#123a6f',
  btnActiveBg: 'rgba(137, 157, 180, 0.26)',
  btnActiveText: '#5c6f85',
  badge: 'CLINICAL',
  gridPattern: 'linear-gradient(90deg, rgba(99,132,170,0.12) 1px, transparent 1px), linear-gradient(0deg, rgba(99,132,170,0.12) 1px, transparent 1px)',
  gridSize: '20px 20px',
  gridOpacity: 0.16,
  glow: 'radial-gradient(ellipse at 25% -8%, rgba(47,128,237,0.04), transparent 50%)',
  mediaOverlay: 'linear-gradient(160deg, rgba(47, 128, 237, 0.08), rgba(203, 224, 246, 0.2))',
});

const CLINICAL_COPY = Object.freeze({
  title: 'Clinical Filter Bench',
  subtitle: 'Legibility & Latency Evaluation',
  onboarding: 'Adjust parameters on the right panel. Observe the clinical effects here.',
  footer: 'END OF REPORT // SCROLL SEGMENT READY',

  author: 'clinical.lab',
  handle: '@filter_bench',
  timeAgo: '1h',
  postCaption: 'Baseline sentence for font distortion calibration.',
  bodyFallback: 'Clinical mode prioritizes readability and controlled contrast so filter effects can be audited without visual noise.',

  likes: '3,204',
  comments: '142',
  shares: '568',
  views: '12K',
  textPostTimeAgo: '4h',
  textPostLikes: '928',
  textPostComments: '56',

  inputLabel: 'Keyboard Latency',
  inputHint: 'Measure controlled delay between typed input and rendered output.',
  inputPlaceholder: 'clinical://capture-sequence',
  clickLabel: 'Interaction Latency',
  clickHint: 'Run repeated trigger tests for queued action release.',
  clickIdle: 'Initiate',
  clickPending: 'Pending',
  clickMetric: 'Events',
});

export default function ClinicalFilterTest({ variant, baseText, sourceText, settings, hiddenMetrics, platformId }) {
  return (
    <ThemeFilterTestScaffold
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      settings={settings}
      hiddenMetrics={hiddenMetrics}
      platformId={platformId}
      palette={CLINICAL_PALETTE}
      copy={CLINICAL_COPY}
      layoutVariant="editorial"
    />
  );
}
