import React, { useEffect, useMemo, useState } from 'react';
import {
  resolveSettingsPreviewChromeVariant,
  SettingsPreviewWindow,
  normalizeSettingsPreviewPlatformId,
  takePreviewLines,
} from './settingsPreviewMockups.jsx';
import {
  getTextRhythmShuffleDistanceDistribution,
  seededShuffleWords,
} from '../../../../../domains/settings/config/settingsConfig.js';
import {
  SETTINGS_PREVIEW_MEDIA_VARIANTS,
  getPreviewTextBatch,
  pickRandom,
} from '../../../../../domains/settings/config/settingsPreviewConfig.js';
import { isExperimentalSettingsEnabled } from '../../../../../platform/browser/dev/settingsExperimentalFlag.js';

export default function SettingsPreviewSection({ activeSettings, isOpen, platformId = 'default', themeId }) {
  const [previewLines, setPreviewLines] = useState([]);
  const normalizedPlatformId = normalizeSettingsPreviewPlatformId(platformId);
  const usesMinimalChrome = resolveSettingsPreviewChromeVariant(themeId) === 'minimal';

  useEffect(() => {
    const rawLines = getPreviewTextBatch({
      platformId: normalizedPlatformId,
      themeId,
      count: 8,
    });
    setPreviewLines(rawLines);
  }, [normalizedPlatformId, themeId]);

  const shuffleDistanceDistribution = getTextRhythmShuffleDistanceDistribution(activeSettings.textRhythm);
  const previewBaseText = useMemo(
    () => previewLines.filter(Boolean).join('\n'),
    [previewLines]
  );

  const shuffledText = useMemo(() => {
    if (!previewBaseText) return '';
    return seededShuffleWords(previewBaseText, previewBaseText, shuffleDistanceDistribution);
  }, [previewBaseText, shuffleDistanceDistribution]);

  const baselineLines = takePreviewLines(previewBaseText);
  const displayLines = takePreviewLines(shuffledText);
  const showExperimental = isExperimentalSettingsEnabled();
  const mediaVariant = showExperimental
    ? pickRandom(SETTINGS_PREVIEW_MEDIA_VARIANTS)
    : 'default';
  const previewVariant = mediaVariant && typeof mediaVariant === 'object' ? mediaVariant : null;

  return (
    <div className={`relative h-full min-h-0 w-full overflow-hidden border bg-surface ${usesMinimalChrome ? 'rounded-[2px] border-border/20' : 'rounded-[10px] border-border/25'}`}>
      <SettingsPreviewWindow
        platformId={normalizedPlatformId}
        variant={previewVariant}
        baseText={displayLines}
        sourceText={baselineLines}
        settings={activeSettings}
        themeId={themeId}
      />
    </div>
  );
}
