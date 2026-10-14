import React from 'react';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';

const CYBERPUNK_PALETTE = Object.freeze({
  bg: '#020612',
  surface: 'rgba(5, 20, 40, 0.8)',
  surfaceAlt: 'rgba(4, 16, 32, 0.86)',
  border: 'rgba(0, 243, 255, 0.34)',
  borderSubtle: 'rgba(0, 243, 255, 0.18)',
  text: '#d8f2ff',
  textMuted: '#7ea9cb',
  textFaint: 'rgba(126, 169, 203, 0.5)',
  accent: '#00f3ff',
  accentSoft: 'rgba(0, 243, 255, 0.2)',
  accentDark: '#001016',
  btnBg: 'rgba(0, 243, 255, 0.18)',
  btnText: '#d4fbff',
  btnActiveBg: 'rgba(112, 86, 178, 0.32)',
  btnActiveText: '#b4a5d6',
  badge: 'CYBERPUNK',
  gridPattern: 'linear-gradient(90deg, rgba(0,243,255,0.1) 1px, transparent 1px), linear-gradient(0deg, rgba(106,92,255,0.1) 1px, transparent 1px)',
  gridSize: '18px 18px',
  gridOpacity: 0.28,
  glow: 'radial-gradient(ellipse at 80% -5%, rgba(106,92,255,0.12), transparent 45%), radial-gradient(ellipse at 10% 105%, rgba(0,243,255,0.08), transparent 40%)',
  mediaOverlay: 'linear-gradient(160deg, rgba(0, 243, 255, 0.18), rgba(106, 92, 255, 0.22))',
});

const CYBERPUNK_COPY = Object.freeze({
  title: 'Neon Friction Deck',
  subtitle: 'Cityline Signal Stress Test',
  onboarding: 'Tune friction nodes on the right. This feed reflects all distortion in real time.',
  footer: 'BUFFER GRID // LIVE MONITORING',

  author: 'neon.deck',
  handle: '@uplink_77',
  timeAgo: '48m',
  postCaption: 'Neon baseline sentence for distortion pressure checks.',
  bodyFallback: 'Cyberpunk mode keeps high chroma and sharp edges so visual degradation is obvious when friction filters escalate.',

  likes: '7,204',
  comments: '412',
  shares: '2.1K',
  views: '42K',
  textPostTimeAgo: '3h',
  textPostLikes: '1,842',
  textPostComments: '128',

  inputLabel: 'Neural Input Bus',
  inputHint: 'Trace delayed input packets through neon relay lanes.',
  inputPlaceholder: 'uplink://node-77/input',
  clickLabel: 'Action Delay Node',
  clickHint: 'Queue trigger events and validate packet release timing.',
  clickIdle: 'Fire',
  clickPending: 'Buffering',
  clickMetric: 'Packets',
});

export default function CyberpunkFilterTest({ variant, baseText, sourceText, settings, hiddenMetrics, platformId }) {
  return (
    <ThemeFilterTestScaffold
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      settings={settings}
      hiddenMetrics={hiddenMetrics}
      platformId={platformId}
      palette={CYBERPUNK_PALETTE}
      copy={CYBERPUNK_COPY}
      layoutVariant="console"
    />
  );
}
