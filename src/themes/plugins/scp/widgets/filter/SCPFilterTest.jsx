import React from 'react';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';

const SCP_PALETTE = Object.freeze({
  bg: '#09090b',
  surface: 'rgba(19, 19, 21, 0.88)',
  surfaceAlt: 'rgba(13, 13, 15, 0.94)',
  border: 'rgba(197, 34, 34, 0.34)',
  borderSubtle: 'rgba(197, 34, 34, 0.18)',
  text: '#f3f0ed',
  textMuted: '#b9a9a3',
  textFaint: 'rgba(185, 169, 163, 0.5)',
  accent: '#c52222',
  accentSoft: 'rgba(197, 34, 34, 0.22)',
  accentDark: '#240808',
  btnBg: 'rgba(197, 34, 34, 0.18)',
  btnText: '#f6ebeb',
  btnActiveBg: 'rgba(121, 44, 44, 0.38)',
  btnActiveText: '#d7bebd',
  badge: 'SCP',
  gridPattern: 'linear-gradient(90deg, rgba(197,34,34,0.12) 1px, transparent 1px), linear-gradient(0deg, rgba(197,34,34,0.1) 1px, transparent 1px)',
  gridSize: '20px 20px',
  gridOpacity: 0.18,
  glow: 'radial-gradient(ellipse at 50% -8%, rgba(197,34,34,0.08), transparent 46%)',
  mediaOverlay: 'linear-gradient(160deg, rgba(197, 34, 34, 0.14), rgba(9, 9, 11, 0.32))',
});

const SCP_COPY = Object.freeze({
  title: 'SCP Containment Bench',
  subtitle: 'Anomaly Filter Observation',
  onboarding: 'Adjust the containment filters on the right. This chamber reveals each distortion immediately.',
  footer: 'CONTAINMENT GRID // ACTIVE OBSERVATION',

  author: 'site.19',
  handle: '@containment_log',
  timeAgo: '3h',
  postCaption: 'Containment baseline sentence for interference validation.',
  bodyFallback: 'SCP mode keeps anomaly signals visible while preserving a measurable baseline for every friction filter.',

  likes: '1,904',
  comments: '87',
  shares: '241',
  views: '5.7K',
  textPostTimeAgo: '9h',
  textPostLikes: '612',
  textPostComments: '33',

  inputLabel: 'Containment Input',
  inputHint: 'Observe delayed release between typed commands and secured output.',
  inputPlaceholder: 'scp://site-19/containment',
  clickLabel: 'Seal Trigger',
  clickHint: 'Queue action releases and verify anomaly gating latency.',
  clickIdle: 'Seal',
  clickPending: 'Locking',
  clickMetric: 'Seals',
});

export default function SCPFilterTest({ variant, baseText, sourceText, settings, hiddenMetrics, platformId }) {
  return (
    <ThemeFilterTestScaffold
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      settings={settings}
      hiddenMetrics={hiddenMetrics}
      platformId={platformId}
      palette={SCP_PALETTE}
      copy={SCP_COPY}
      layoutVariant="editorial"
    />
  );
}
