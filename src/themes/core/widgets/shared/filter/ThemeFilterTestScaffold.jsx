import React, { useMemo } from 'react';
import {
  MockMetric,
  PreviewMediaImg,
  PreviewText,
} from '@/themes/core/widgets/shared/preview/Common.jsx';
import useLabSimulationState from './useLabSimulationState.js';

const DEFAULT_PALETTE = Object.freeze({
  bg: '#040812',
  surface: 'rgba(8, 14, 28, 0.86)',
  surfaceAlt: 'rgba(7, 11, 20, 0.92)',
  border: 'rgba(121, 152, 194, 0.34)',
  borderSubtle: 'rgba(121, 152, 194, 0.18)',
  text: '#deebff',
  textMuted: '#8ca9cf',
  textFaint: 'rgba(140, 169, 207, 0.5)',
  accent: '#5fd3ff',
  accentSoft: 'rgba(95, 211, 255, 0.22)',
  accentDark: '#03121d',
  btnBg: 'rgba(95, 211, 255, 0.2)',
  btnText: '#dbf6ff',
  btnActiveBg: 'rgba(88, 104, 137, 0.34)',
  btnActiveText: '#bac8dc',
  badge: 'FILTER LAB',
  gridPattern:
    'linear-gradient(90deg, rgba(120,145,170,0.12) 1px, transparent 1px), linear-gradient(0deg, rgba(120,145,170,0.12) 1px, transparent 1px)',
  gridSize: '20px 20px',
  gridOpacity: 0.2,
  glow: 'radial-gradient(ellipse at 20% -10%, rgba(255,255,255,0.05), transparent 50%)',
  mediaOverlay: 'linear-gradient(155deg, rgba(95, 211, 255, 0.14), rgba(4, 8, 14, 0.3))',
});

const DEFAULT_COPY = Object.freeze({
  title: 'Filter Experiment Lab',
  subtitle: 'Interactive Validation Surface',
  onboarding: 'Adjust controls on the right. Active filters are mapped to zones below.',
  footer: 'SESSION // ACTIVE',

  author: 'lab.signal',
  handle: '@lab_signal',
  timeAgo: '2h',
  postCaption: 'Baseline content for filter validation.',
  bodyFallback:
    'This surface validates visual, text, interaction, and metric filters in one controlled flow.',

  likes: '5,842',
  comments: '284',
  shares: '1.2K',
  views: '26K',
  textPostTimeAgo: '5h',
  textPostLikes: '1,204',
  textPostComments: '89',

  inputLabel: 'Input Echo',
  inputHint: 'Type freely. delayed echo should reflect input delay.',
  inputPlaceholder: 'Type here to test input delay...',
  clickLabel: 'Action Queue',
  clickHint: 'Trigger actions and inspect delayed release.',
  clickIdle: 'Execute',
  clickPending: 'Queued',
  clickMetric: 'Released',
});

function formatClock(ts) {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function ZoneCard({ palette, zoneId, title, subtitle, highlighted, effectLabels = [], children }) {
  return (
    <section
      data-lab-zone={zoneId}
      className="rounded-2xl border p-3 transition-shadow duration-200"
      style={{
        borderColor: highlighted ? palette.accent : palette.borderSubtle,
        background: palette.surface,
        boxShadow: highlighted ? `0 0 0 1px ${palette.accentSoft}, 0 0 28px rgba(0,0,0,0.2)` : 'none',
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: palette.textMuted }}>
            {title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <span
          className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em]"
          style={{
            borderColor: highlighted ? palette.accent : palette.borderSubtle,
            color: highlighted ? palette.accent : palette.textFaint,
            background: highlighted ? palette.accentSoft : 'transparent',
          }}
        >
          {zoneId}
        </span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {effectLabels.length > 0 ? (
          effectLabels.map((label) => (
            <span
              key={`${zoneId}_${label}`}
              className="rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]"
              style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt, color: palette.textFaint }}
            >
              {label}
            </span>
          ))
        ) : (
          <span
            className="rounded-full border border-dashed px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]"
            style={{ borderColor: palette.borderSubtle, color: palette.textFaint }}
          >
            no active effect
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function EffectChip({ palette, effect }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
      style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt, color: palette.textMuted }}
    >
      <span style={{ color: palette.accent }}>{effect.label}</span>
      {effect.value ? <span>{effect.value}</span> : null}
    </span>
  );
}

function MetricRow({ palette, hideEngagement, hideExposure, copy }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
      <MockMetric kind="engagement" hidden={hideEngagement} className="rounded-lg border px-2 py-1" style={{ borderColor: palette.borderSubtle }}>
        <span style={{ color: palette.textFaint }}>Likes </span>
        <span style={{ color: palette.textMuted }}>{copy.likes}</span>
      </MockMetric>
      <MockMetric kind="engagement" hidden={hideEngagement} className="rounded-lg border px-2 py-1" style={{ borderColor: palette.borderSubtle }}>
        <span style={{ color: palette.textFaint }}>Comments </span>
        <span style={{ color: palette.textMuted }}>{copy.comments}</span>
      </MockMetric>
      <MockMetric kind="engagement" hidden={hideEngagement} className="rounded-lg border px-2 py-1" style={{ borderColor: palette.borderSubtle }}>
        <span style={{ color: palette.textFaint }}>Shares </span>
        <span style={{ color: palette.textMuted }}>{copy.shares}</span>
      </MockMetric>
      <MockMetric kind="exposure" hidden={hideExposure} className="rounded-lg border px-2 py-1" style={{ borderColor: palette.borderSubtle }}>
        <span style={{ color: palette.textFaint }}>Views </span>
        <span style={{ color: palette.textMuted }}>{copy.views}</span>
      </MockMetric>
    </div>
  );
}

export default function ThemeFilterTestScaffold({
  variant,
  baseText,
  sourceText,
  settings,
  hiddenMetrics,
  platformId = 'default',
  palette: paletteOverride = {},
  copy: copyOverride = {},
  layoutVariant = 'console',
}) {
  const isNightLab = platformId === 'default-dark';

  const palette = useMemo(() => {
    const merged = { ...DEFAULT_PALETTE, ...paletteOverride };
    if (!isNightLab) return merged;
    return {
      ...merged,
      badge: `${merged.badge} NIGHT`,
      gridOpacity: Math.min(0.5, (Number(merged.gridOpacity) || 0.2) + 0.1),
      glow:
        'radial-gradient(ellipse at 85% -8%, rgba(95,211,255,0.16), transparent 42%), radial-gradient(ellipse at 15% 108%, rgba(255,255,255,0.08), transparent 44%)',
    };
  }, [paletteOverride, isNightLab]);

  const copy = useMemo(() => ({ ...DEFAULT_COPY, ...copyOverride }), [copyOverride]);

  const thumbUrl = variant?.url || 'assets/images/sample-landscape.jpg';

  const {
    compareMode,
    setCompareMode,
    activeEffects,
    highlightedZones,
    traceEntries,
    bodyLines,
    bodyLinesBefore,
    bodyLinesAfter,
    hideEngagement,
    hideExposure,
    liveInput,
    delayedInput,
    handleInput,
    handleClick,
    pendingSnaps,
    queueDepth,
    resolvedCount,
    inputDelayMs,
    clickDelayMs,
    scrollDelayMs,
  } = useLabSimulationState({
    settings,
    baseText,
    sourceText,
    hiddenMetrics,
    bodyFallback: copy.bodyFallback,
  });

  const isEditorial = layoutVariant === 'editorial';
  const zoneEffectsById = useMemo(() => {
    const next = {
      media: [],
      text: [],
      interaction: [],
      metrics: [],
    };

    activeEffects.forEach((effect) => {
      effect.zones.forEach((zoneId) => {
        if (!next[zoneId]) return;
        next[zoneId].push(effect.label);
      });
    });

    return next;
  }, [activeEffects]);

  const mediaZone = (
    <ZoneCard
      palette={palette}
      zoneId="media"
      title="Media Zone"
      subtitle="visual filters"
      highlighted={highlightedZones.has('media')}
      effectLabels={zoneEffectsById.media}
    >
      <div className="rounded-xl border" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt }}>
        <div className="flex items-center justify-between px-2 py-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>
          <span>{copy.author}</span>
          <span>{copy.timeAgo}</span>
        </div>
        <div className="relative aspect-[16/9] overflow-hidden border-y" style={{ borderColor: palette.borderSubtle }}>
          <PreviewMediaImg src={thumbUrl} className="h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: palette.mediaOverlay }} />
        </div>
        <div className="px-2 py-2">
          <PreviewText className="text-xs leading-relaxed" isDynamic>
            {copy.postCaption}
          </PreviewText>
        </div>
      </div>
    </ZoneCard>
  );

  const textZone = (
    <ZoneCard
      palette={palette}
      zoneId="text"
      title="Text Zone"
      subtitle={compareMode === 'after' ? 'filtered' : 'baseline'}
      highlighted={highlightedZones.has('text')}
      effectLabels={zoneEffectsById.text}
    >
      <div className="space-y-2">
        {bodyLines.map((line, index) => (
          <div key={`${index}_${line.slice(0, 16)}`} className="rounded-lg border px-3 py-2" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt }}>
            <div className="mb-0.5 text-[9px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>
              Line {String(index + 1).padStart(2, '0')}
            </div>
            <PreviewText className="text-xs leading-relaxed" isDynamic>
              {line}
            </PreviewText>
          </div>
        ))}
      </div>
    </ZoneCard>
  );

  const interactionZone = (
    <ZoneCard
      palette={palette}
      zoneId="interaction"
      title="Interaction Zone"
      subtitle="input + click + scroll"
      highlighted={highlightedZones.has('interaction')}
      effectLabels={zoneEffectsById.interaction}
    >
      <div className="grid gap-3">
        <div className="rounded-xl border p-2" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt }}>
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]" style={{ color: palette.textMuted }}>
            <span>{copy.inputLabel}</span>
            <span className="rounded-full px-1.5 py-0.5 tabular-nums" style={{ background: palette.accentSoft, color: palette.accent }}>
              {compareMode === 'after' ? inputDelayMs : 0}ms
            </span>
          </div>
          <p className="mb-2 text-[10px]" style={{ color: palette.textFaint }}>{copy.inputHint}</p>
          <textarea
            className="h-16 w-full resize-none rounded-md border bg-transparent px-2 py-1.5 text-sm outline-hidden"
            style={{ borderColor: palette.borderSubtle, color: palette.text, caretColor: palette.accent }}
            value={liveInput}
            onChange={handleInput}
            spellCheck={false}
            placeholder={copy.inputPlaceholder}
          />
          <div className="mt-2 rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: palette.borderSubtle, color: palette.text }}>
            {delayedInput || <span style={{ color: palette.textFaint }}>Echo appears here...</span>}
          </div>
        </div>

        <div className="rounded-xl border p-2" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt }}>
          <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.14em]" style={{ color: palette.textMuted }}>
            <span>{copy.clickLabel}</span>
            <span className="rounded-full px-1.5 py-0.5 tabular-nums" style={{ background: palette.accentSoft, color: palette.accent }}>
              {compareMode === 'after' ? clickDelayMs : 0}ms
            </span>
          </div>
          <p className="mb-2 text-[10px]" style={{ color: palette.textFaint }}>{copy.clickHint}</p>
          <button
            type="button"
            onClick={handleClick}
            className="w-full rounded-lg border px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
            style={{
              borderColor: palette.border,
              background: queueDepth > 0 ? palette.btnActiveBg : palette.btnBg,
              color: queueDepth > 0 ? palette.btnActiveText : palette.btnText,
            }}
          >
            {queueDepth > 0 ? copy.clickPending : copy.clickIdle}
          </button>
          <div className="mt-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>
            {copy.clickMetric} <span className="tabular-nums" style={{ color: palette.textMuted }}>{resolvedCount}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {pendingSnaps.length === 0 ? (
              <div className="rounded-md border border-dashed px-2 py-1 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: palette.borderSubtle, color: palette.textFaint }}>
                Queue idle
              </div>
            ) : (
              pendingSnaps.map((snap) => (
                <div key={snap.id} className="rounded-md border px-2 py-1" style={{ borderColor: palette.borderSubtle }}>
                  <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.1em]" style={{ color: palette.textFaint }}>
                    <span>#{snap.id}</span>
                    <span className="tabular-nums">{snap.remain}ms</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full" style={{ background: palette.borderSubtle }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round(snap.progress * 100)}%`, background: palette.accent }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border px-2 py-1.5 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt, color: palette.textFaint }}>
          Scroll inertia
          <span className="ml-2 tabular-nums" style={{ color: palette.textMuted }}>
            {compareMode === 'after' ? scrollDelayMs : 0}ms
          </span>
        </div>
      </div>
    </ZoneCard>
  );

  const metricsZone = (
    <ZoneCard
      palette={palette}
      zoneId="metrics"
      title="Metrics Zone"
      subtitle="social engagement + exposure"
      highlighted={highlightedZones.has('metrics')}
      effectLabels={zoneEffectsById.metrics}
    >
      <MetricRow palette={palette} hideEngagement={hideEngagement} hideExposure={hideExposure} copy={copy} />
    </ZoneCard>
  );

  const traceZone = (
    <section className="rounded-2xl border p-3" style={{ borderColor: palette.borderSubtle, background: palette.surface }}>
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: palette.textMuted }}>
        Live Trace
      </div>
      <div className="max-h-[170px] space-y-1.5 overflow-y-auto pr-1 fr-scroll">
        {traceEntries.map((entry) => (
          <div key={entry.id} className="rounded-md border px-2 py-1.5 text-[10px]" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt }}>
            <div className="mb-0.5 uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>
              {formatClock(entry.ts)}
            </div>
            <div style={{ color: palette.textMuted }}>{entry.message}</div>
          </div>
        ))}
      </div>
    </section>
  );

  const comparisonStrip = (
    <section className="rounded-2xl border p-3" style={{ borderColor: palette.borderSubtle, background: palette.surface }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: palette.textMuted }}>
          Split Compare
        </div>
        <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>
          {compareMode === 'after' ? 'Filtered mode active' : 'Baseline mode active'}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <article className="rounded-xl border p-2.5" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt }}>
          <div className="mb-1 text-[9px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>Baseline</div>
          <div className="mb-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: palette.textMuted }}>
            <span>Input 0ms</span>
            <span>Click 0ms</span>
            <span>Scroll 0ms</span>
          </div>
          <div className="space-y-1">
            {bodyLinesBefore.slice(0, 2).map((line, idx) => (
              <div key={`before_${idx}_${line.slice(0, 12)}`} className="rounded-md border px-2 py-1 text-[10px]" style={{ borderColor: palette.borderSubtle, color: palette.textFaint }}>
                {line}
              </div>
            ))}
          </div>
        </article>
        <article
          className="rounded-xl border p-2.5"
          style={{
            borderColor: compareMode === 'after' ? palette.accent : palette.borderSubtle,
            background: palette.surfaceAlt,
            boxShadow: compareMode === 'after' ? `0 0 0 1px ${palette.accentSoft}` : 'none',
          }}
        >
          <div className="mb-1 text-[9px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>Filtered</div>
          <div className="mb-1 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em]" style={{ color: palette.textMuted }}>
            <span>Input {inputDelayMs}ms</span>
            <span>Click {clickDelayMs}ms</span>
            <span>Scroll {scrollDelayMs}ms</span>
          </div>
          <div className="space-y-1">
            {bodyLinesAfter.slice(0, 2).map((line, idx) => (
              <div key={`after_${idx}_${line.slice(0, 12)}`} className="rounded-md border px-2 py-1 text-[10px]" style={{ borderColor: palette.borderSubtle, color: palette.textMuted }}>
                {line}
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );

  return (
    <div
      className="relative flex h-full w-full min-h-[860px] flex-col overflow-x-hidden overflow-y-auto font-mono fr-scroll"
      style={{ background: palette.bg, color: palette.text }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: palette.gridPattern,
          backgroundSize: palette.gridSize,
          opacity: palette.gridOpacity,
        }}
      />
      <div className="pointer-events-none absolute inset-0" style={{ background: palette.glow }} />

      <div className="relative z-10 mx-auto flex w-full max-w-[980px] flex-col gap-3 px-4 py-5 md:px-6">
        <header className="rounded-2xl border p-4" style={{ borderColor: palette.border, background: palette.surface }}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.16em]" style={{ borderColor: palette.borderSubtle, color: palette.textFaint }}>
              {palette.badge}
            </span>
            <div className="inline-flex items-center rounded-lg border p-0.5" style={{ borderColor: palette.borderSubtle, background: palette.surfaceAlt }}>
              <button
                type="button"
                onClick={() => setCompareMode('before')}
                className="rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                style={{
                  background: compareMode === 'before' ? palette.accentSoft : 'transparent',
                  color: compareMode === 'before' ? palette.accent : palette.textFaint,
                }}
              >
                Baseline
              </button>
              <button
                type="button"
                onClick={() => setCompareMode('after')}
                className="rounded-md px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                style={{
                  background: compareMode === 'after' ? palette.accentSoft : 'transparent',
                  color: compareMode === 'after' ? palette.accent : palette.textFaint,
                }}
              >
                Filtered
              </button>
            </div>
          </div>

          <h2 className="text-lg font-black uppercase tracking-[0.12em] md:text-xl" style={{ color: palette.accent }}>
            {copy.title}
          </h2>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em]" style={{ color: palette.textMuted }}>{copy.subtitle}</p>
          <p className="mt-2 rounded-lg border border-dashed px-3 py-2 text-[10px]" style={{ borderColor: palette.borderSubtle, color: palette.textFaint }}>
            {copy.onboarding}
          </p>

          <div className="mt-3">
            <div className="mb-1 text-[9px] uppercase tracking-[0.12em]" style={{ color: palette.textFaint }}>
              Active effects
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeEffects.length > 0 ? (
                activeEffects.map((effect) => <EffectChip key={effect.id} palette={palette} effect={effect} />)
              ) : (
                <span className="rounded-full border border-dashed px-2 py-1 text-[10px] uppercase tracking-[0.12em]" style={{ borderColor: palette.borderSubtle, color: palette.textFaint }}>
                  No active filters
                </span>
              )}
            </div>
          </div>
        </header>

        {comparisonStrip}

        {isEditorial ? (
          <div className="grid gap-3">
            {mediaZone}
            {textZone}
            {interactionZone}
            {metricsZone}
            {traceZone}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="grid gap-3">
              {mediaZone}
              {textZone}
            </div>
            <div className="grid gap-3">
              {interactionZone}
              {metricsZone}
              {traceZone}
            </div>
          </div>
        )}

        <footer className="rounded-xl border border-dashed px-3 py-2 text-center text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: palette.borderSubtle, color: palette.textFaint, background: palette.surface }}>
          {copy.footer}
        </footer>
      </div>
    </div>
  );
}
