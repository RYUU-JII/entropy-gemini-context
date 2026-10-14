import React, { useMemo } from 'react';
import ThemeFilterTestScaffold from '@/themes/core/widgets/shared/filter/index.js';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';

const MATRIX_PALETTE = Object.freeze({
  bg: '#010602',
  surface: 'rgba(4, 20, 9, 0.8)',
  surfaceAlt: 'rgba(3, 16, 7, 0.86)',
  border: 'rgba(57, 255, 20, 0.34)',
  borderSubtle: 'rgba(57, 255, 20, 0.18)',
  text: '#bbf7d0',
  textMuted: '#86efac',
  textFaint: 'rgba(134, 239, 172, 0.5)',
  accent: '#39ff14',
  accentSoft: 'rgba(57, 255, 20, 0.22)',
  accentDark: '#031006',
  btnBg: 'rgba(57, 255, 20, 0.18)',
  btnText: '#d9ffe6',
  btnActiveBg: 'rgba(25, 55, 22, 0.45)',
  btnActiveText: '#87a88a',
  badge: 'MATRIX',
  gridPattern: 'repeating-linear-gradient(180deg, rgba(57,255,20,0.12) 0px, rgba(57,255,20,0.12) 1px, transparent 1px, transparent 4px)',
  gridSize: '20px 4px',
  gridOpacity: 0.32,
  glow: 'radial-gradient(ellipse at 50% -10%, rgba(57,255,20,0.1), transparent 50%)',
  mediaOverlay: 'linear-gradient(160deg, rgba(57, 255, 20, 0.15), rgba(1, 8, 3, 0.35))',
});

export default function MatrixFilterTest({ variant, baseText, sourceText, settings, hiddenMetrics, platformId }) {
  const { t } = useAppTranslation('main');

  const matrixCopy = useMemo(
    () => ({
      title: t('matrix.filter_test.title'),
      subtitle: t('matrix.filter_test.subtitle'),
      onboarding: t('matrix.filter_test.onboarding', 'Adjust parameters on the right. This feed reflects all distortion.'),
      footer: t('matrix.filter_test.scroll_buffer'),

      author: 'matrix.node',
      handle: '@stream_0x1A',
      timeAgo: '12m',
      postCaption: t('matrix.filter_test.preview_sentence'),
      bodyFallback: t('matrix.filter_test.default_base_text'),

      likes: '6,144',
      comments: '256',
      shares: '1.5K',
      views: '32K',
      textPostTimeAgo: '2h',
      textPostLikes: '2,048',
      textPostComments: '128',

      inputLabel: t('matrix.filter_test.keyboard_delay'),
      inputHint: t('matrix.filter_test.waiting_input'),
      inputPlaceholder: '> stream://await-input',
      clickLabel: t('matrix.filter_test.trigger_delay'),
      clickHint: t('matrix.filter_test.pending'),
      clickIdle: t('matrix.filter_test.execute'),
      clickPending: t('matrix.filter_test.pending'),
      clickMetric: 'Cycles',
    }),
    [t]
  );

  return (
    <ThemeFilterTestScaffold
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      settings={settings}
      hiddenMetrics={hiddenMetrics}
      platformId={platformId}
      palette={MATRIX_PALETTE}
      copy={matrixCopy}
      layoutVariant="console"
    />
  );
}
