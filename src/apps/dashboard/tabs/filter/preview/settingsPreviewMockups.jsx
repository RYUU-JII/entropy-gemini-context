import ScrollDelayPreview from './ScrollDelayPreview.jsx';
import SignalCalibration from './platforms/SignalCalibration.jsx';
import MockInstagram from './platforms/Instagram.jsx';
import MockTikTok from './platforms/TikTok.jsx';
import MockX from './platforms/X.jsx';
import MockYoutube from './platforms/Youtube.jsx';

import { getThemeProfile } from '@/themes/core/profile.js';
import { getThemeWidget } from '@/themes/core/registry/index.js';

import {
  getTextFilterVars,
  getVisualFilterVars,
  PREVIEW_TEXT_DEFAULTS,
  PREVIEW_TEXT_VAR_NAMES,
  PREVIEW_VISUAL_DEFAULTS,
  PREVIEW_VISUAL_VAR_NAMES,
} from '../../../../../lib/filterCssVars.js';
import { buildRootVisualFilterValue, resolveSocialMetricVisibilityState } from '../../../../../domains/settings/config/index.js';

import { SETTINGS_PREVIEW_PLATFORMS } from './constants.js';

export { SETTINGS_PREVIEW_PLATFORMS, MOCK_PLATFORM_DATA } from './constants.js';

export function normalizeSettingsPreviewPlatformId(raw) {
  const id = String(raw || '').trim().toLowerCase();
  if (SETTINGS_PREVIEW_PLATFORMS.some((p) => p.id === id)) return id;
  return 'default';
}

export function takePreviewLines(raw, maxLines = 4) {
  const lines = String(raw ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, Math.max(1, maxLines)).join('\n');
}

export function resolveSettingsPreviewChromeVariant(themeId) {
  const chromeVariant = getThemeProfile(themeId)?.settings?.chromeVariant;
  return chromeVariant === 'minimal' ? 'minimal' : 'standard';
}

function getPreviewRootStyle(settings) {
  const rootFilter = buildRootVisualFilterValue(settings);
  return {
    ...getVisualFilterVars(settings, {
      varNames: PREVIEW_VISUAL_VAR_NAMES,
      defaults: PREVIEW_VISUAL_DEFAULTS,
    }),
    ...getTextFilterVars(settings, {
      varNames: PREVIEW_TEXT_VAR_NAMES,
      defaults: PREVIEW_TEXT_DEFAULTS,
    }),
    filter: rootFilter.length > 0 ? rootFilter : 'none',
    willChange: 'filter',
  };
}

function getPreviewScrollDelay(settings) {
  if (!settings?.scrollFriction?.isActive) return 0;
  const raw = settings?.scrollFriction?.value;
  const parsed = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function getHiddenMetrics(settings) {
  const visibility = resolveSocialMetricVisibilityState(settings);
  return {
    engagement: visibility.engagement,
    exposure: visibility.exposure,
    feedbackCounts: visibility.feedbackCounts,
    viewCounts: visibility.viewCounts,
    timeSignals: visibility.timeSignals,
    audienceCounts: visibility.audienceCounts,
  };
}

function getSurfaceState(settings) {
  return {
    socialSurface: !!settings?.hideIcons?.isActive,
  };
}

function resolveDefaultPreviewComponent(themeId) {
  const component = getThemeWidget(themeId, 'FilterTest');
  if (!component) {
    const error = new Error(`FILTER_PREVIEW_THEME_WIDGET_REQUIRED:${themeId}:FilterTest`);
    error.code = 'FILTER_PREVIEW_THEME_WIDGET_REQUIRED';
    error.themeId = themeId;
    error.widgetType = 'FilterTest';
    throw error;
  }
  return component;
}

function SettingsPreviewContent({ platformId, variant, baseText, sourceText, hiddenMetrics, surfaceState, settings, themeId }) {
  const normalized = normalizeSettingsPreviewPlatformId(platformId);

  let Component;
  switch (normalized) {
    case 'youtube': Component = MockYoutube; break;
    case 'instagram': Component = MockInstagram; break;
    case 'tiktok': Component = MockTikTok; break;
    case 'x': Component = MockX; break;
    case 'default':
    case 'default-dark':
      Component = resolveDefaultPreviewComponent(themeId);
      break;
    default:
      Component = SignalCalibration;
      break;
  }

  return (
    <Component
      variant={variant}
      baseText={baseText}
      sourceText={sourceText}
      hiddenMetrics={hiddenMetrics}
      surfaceState={surfaceState}
      settings={settings}
      platformId={normalized}
    />
  );
}

export function SettingsPreviewWindow({
  platformId,
  variant,
  baseText,
  sourceText,
  settings,
  focusCategory,
  scrollTop,
  onScroll,
  themeId
}) {
  const hiddenMetrics = getHiddenMetrics(settings);
  const surfaceState = getSurfaceState(settings);
  const normalized = normalizeSettingsPreviewPlatformId(platformId);
  const style = getPreviewRootStyle(settings);
  const scrollDelayMs = getPreviewScrollDelay(settings);
  const usesMinimalChrome = resolveSettingsPreviewChromeVariant(themeId) === 'minimal';

  return (
    <div
      className="flex h-full w-full flex-col text-on-surface"
      data-platform={normalized}
      data-focus={focusCategory ? String(focusCategory) : undefined}
      style={style}
    >
      <ScrollDelayPreview
        delayMs={scrollDelayMs}
        scrollTop={scrollTop}
        onScroll={onScroll}
        className={`fr-scroll flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto ${usesMinimalChrome ? 'bg-background' : 'bg-linear-to-b/srgb from-surface-elevated/25 to-transparent'}`}
        style={{ scrollbarGutter: 'auto' }}
      >
        <div className="flex min-h-full w-full flex-1 flex-col p-3">
          <div className={`flex min-h-[560px] flex-1 overflow-hidden border ${usesMinimalChrome ? 'rounded-[2px] border-border/20 bg-surface shadow-none' : 'rounded-[10px] border-border/30 bg-surface-elevated/40 shadow-sm'}`}>
            <SettingsPreviewContent
              platformId={normalized}
              variant={variant}
              baseText={baseText}
              sourceText={sourceText}
              settings={settings}
              hiddenMetrics={hiddenMetrics}
              surfaceState={surfaceState}
              themeId={themeId}
            />
          </div>
        </div>
      </ScrollDelayPreview>
    </div>
  );
}
