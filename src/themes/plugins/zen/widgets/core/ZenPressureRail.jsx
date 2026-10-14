import React, { useMemo } from 'react';

import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import ZenPressureSegments from './ZenPressureSegments.jsx';
import { useZenPressureRailEngagement } from './hooks/useZenPressureRailEngagement.js';
import { resolveZenPressureText } from './zenPressureRailFormatters.js';
import { ZEN_PRESSURE_FRAME_STYLE } from './zenPressureRailTonePolicy.js';
import {
  buildZenPressureRailPresentationModel,
  layoutZenPressureRail,
} from './zenPressureRailPresentationModel.js';
import './ZenPressureRail.css';

const PRESSURE_RAIL_STATES = Object.freeze({
  COLLECTING: 'collecting',
  READY: 'ready',
  ERROR: 'error',
});
const PRESSURE_RAIL_CONTENT_STATES = Object.freeze({
  PENDING: 'pending',
  PRESSURE: 'pressure',
  NO_PRESSURE: 'no_pressure',
  UNAVAILABLE: 'unavailable',
});

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function resolveReadiness(pressureSummary) {
  const readiness = pressureSummary?.readiness;
  const state = typeof readiness?.state === 'string' ? readiness.state : PRESSURE_RAIL_STATES.ERROR;
  if (!Object.values(PRESSURE_RAIL_STATES).includes(state)) {
    throw new Error(`ZEN_PRESSURE_READINESS_STATE_INVALID:${String(state || '')}`);
  }
  if (state === PRESSURE_RAIL_STATES.ERROR) {
    return {
      ...readiness,
      state,
      contentState: PRESSURE_RAIL_CONTENT_STATES.UNAVAILABLE,
      observedDayCount: 0,
      targetDayCount: 0,
    };
  }
  if (!Number.isInteger(readiness?.observedDayCount) || readiness.observedDayCount < 0) {
    throw new Error('ZEN_PRESSURE_READINESS_OBSERVED_DAYS_INVALID');
  }
  if (!Number.isInteger(readiness?.targetDayCount) || readiness.targetDayCount < 1) {
    throw new Error('ZEN_PRESSURE_READINESS_TARGET_DAYS_INVALID');
  }
  const contentState = readiness?.contentState;
  const contentStateValid = state === PRESSURE_RAIL_STATES.COLLECTING
    ? contentState === PRESSURE_RAIL_CONTENT_STATES.PENDING
    : [
        PRESSURE_RAIL_CONTENT_STATES.PRESSURE,
        PRESSURE_RAIL_CONTENT_STATES.NO_PRESSURE,
      ].includes(contentState);
  if (!contentStateValid) {
    throw new Error(`ZEN_PRESSURE_READINESS_CONTENT_STATE_INVALID:${String(contentState || '')}`);
  }
  return { ...readiness, state };
}

function resolveRailLabel(t, pressureSummary, readiness) {
  if (readiness.state === PRESSURE_RAIL_STATES.COLLECTING) {
    return resolveZenPressureText(
      t,
      'target_protocol.pressure_collecting',
      { observed: readiness.observedDayCount, target: readiness.targetDayCount },
      `Collecting flow · ${readiness.observedDayCount}/${readiness.targetDayCount} days`,
    );
  }
  if (
    readiness.state === PRESSURE_RAIL_STATES.READY
    && readiness.contentState === PRESSURE_RAIL_CONTENT_STATES.NO_PRESSURE
  ) {
    return resolveZenPressureText(
      t,
      'target_protocol.pressure_no_pressure',
      {},
      'No recent pressure',
    );
  }
  if (readiness.state === PRESSURE_RAIL_STATES.ERROR) {
    return resolveZenPressureText(
      t,
      'target_protocol.pressure_unavailable',
      {},
      'Pressure unavailable',
    );
  }
  const windowDays = Math.max(0, Math.floor(toNumber(pressureSummary?.windowDays)));
  if (pressureSummary?.mode === 'closed-day') {
    return resolveZenPressureText(t, 'target_protocol.closed_day_share', {}, 'Closed-day share');
  }
  return windowDays > 0
    ? resolveZenPressureText(
        t,
        'target_protocol.recent_pressure_window',
        { days: windowDays },
        `Recent ${windowDays}-day pressure`,
      )
    : resolveZenPressureText(t, 'target_protocol.recent_pressure', {}, 'Recent pressure');
}

// Without pressure the rail still has to say which of three conditions it is in.
// Each state gets its own line form as well as a visible inscription, so the
// difference never rests on colour or on assistive text alone:
// collecting = notches counting toward the target, no pressure = one unbroken
// line, unavailable = an interrupted line in shu ink.
function ZenPressureReadinessRail({ readiness, frameVariant, label }) {
  const usesSlabCut = frameVariant === 'slab-cut';
  const collecting = readiness.state === PRESSURE_RAIL_STATES.COLLECTING;
  return (
    <div
      data-testid="pressure-rail-readiness"
      data-state={readiness.state}
      data-content-state={readiness.contentState}
      data-target-days={readiness.targetDayCount || undefined}
      className={`zen-pressure-readiness-rail ${usesSlabCut ? '' : 'border-t'}`}
      style={usesSlabCut ? undefined : { borderColor: 'var(--color-border-muted)' }}
    >
      {collecting ? (
        <span className="zen-pressure-readiness-rail__notches" aria-hidden="true">
          {Array.from({ length: readiness.targetDayCount }, (_, index) => (
            <span
              key={index}
              className="zen-pressure-readiness-rail__notch"
              data-observed={index < readiness.observedDayCount ? 'true' : 'false'}
            />
          ))}
        </span>
      ) : null}
      <span className="zen-pressure-readiness-rail__inscription">{label}</span>
    </div>
  );
}

export default function ZenPressureRail({
  pressureSummary = null,
  pressureSites = [],
  hoveredDomain = null,
  onSelectDomain = null,
  onHoverDomain = null,
  onInteractionActiveChange = null,
  dataWidth = null,
  frameVariant = 'card',
  className = '',
}) {
  const { t } = useAppTranslation('main');
  const { railRef, engagementHandlers } = useZenPressureRailEngagement(onInteractionActiveChange);
  const usesSlabCut = frameVariant === 'slab-cut';
  const readiness = useMemo(() => resolveReadiness(pressureSummary), [pressureSummary]);
  const ready = readiness.state === PRESSURE_RAIL_STATES.READY;
  const showsPressure = ready
    && readiness.contentState === PRESSURE_RAIL_CONTENT_STATES.PRESSURE;
  const model = useMemo(
    () => buildZenPressureRailPresentationModel(showsPressure ? pressureSites : [], pressureSummary),
    [pressureSites, pressureSummary, showsPressure],
  );
  const layout = useMemo(() => dataWidth === null ? null : layoutZenPressureRail(model, dataWidth), [model, dataWidth]);
  const label = resolveRailLabel(t, pressureSummary, readiness);

  return (
    <section
      ref={railRef}
      data-testid="zen-pressure-rail"
      data-frame-variant={frameVariant}
      data-readiness={readiness.state}
      data-content-state={readiness.contentState}
      aria-label={label}
      {...engagementHandlers}
      className={`zen-pressure-rail relative flex h-full min-h-0 w-full flex-col overflow-visible ${usesSlabCut ? 'rounded-none border-0' : 'rounded-[16px] border'} ${className}`}
      style={{
        ...ZEN_PRESSURE_FRAME_STYLE,
        ...(usesSlabCut ? {} : { borderColor: 'var(--zen-pressure-frame-divider)' }),
      }}
    >
      {showsPressure ? <span className="sr-only">{label}</span> : null}
      <div data-testid="pressure-segment-row" className="h-full w-full min-h-0 overflow-x-auto overflow-y-hidden">
        {showsPressure && layout && (model.segments.length > 0 || model.otherSegment) ? (
          <ZenPressureSegments
            model={layout}
            frameVariant={frameVariant}
            hoveredDomain={hoveredDomain}
            onSelectDomain={onSelectDomain}
            onHoverDomain={onHoverDomain}
            t={t}
          />
        ) : !showsPressure ? (
          <ZenPressureReadinessRail readiness={readiness} frameVariant={frameVariant} label={label} />
        ) : null}
      </div>
    </section>
  );
}
