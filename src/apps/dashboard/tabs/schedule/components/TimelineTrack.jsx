import React, { useEffect, useRef, useState } from 'react';
import ZenScheduleSandSurface from './ZenScheduleSandSurface.jsx';
import { getTimelineSegments } from '../scheduleTimelineGeometry.js';
import {
  MINUTES_IN_DAY,
  STEP_MINUTES,
  INPUT_MIN_GAP,
  addScheduleBlockAtTime,
  areSchedulesEqual,
  doesBlockApplyToDays,
  minToTime,
  moveBlockTime,
  normalizeDays,
  updateBlockTime,
} from '../scheduleModel.js';
import { useAppTranslation } from '../../../../../ui-kit/hooks/useAppTranslation.js';
import {
  SCHEDULE_RECIPE_VARIANTS,
  resolveScheduleRecipeVariant,
} from '../../../../../themes/core/scheduleVisualPolicy.js';

const DRAG_ACTIVATION_DISTANCE_PX = 4;
const ENDPOINT_HIT_WIDTH = 'min(12px, 28%)';

function translucent(color, percent) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return `color-mix(in srgb, ${color} ${safePercent}%, transparent)`;
}

function TimelineTrack({
  activeSchedule,
  onDraftChange,
  onCommit,
  onSelectBlock,
  onAddBlock,
  selectedBlockId,
  editorPreviewBlock = null,
  onInteractionPreview,
  onDragStatusChange,
  visualTokens,
  typography,
  variant,
  timelinePolicy,
  nowTs,
  resetHour = 4,
  isFirstBlockGuide = false,
  showInlineEmptyAction = false,
  visibleDays = null,
  creationDays = null,
  surfaceSeed = 0,
}) {
  const { t } = useAppTranslation('schedule');
  const trackRef = useRef(null);
  const pendingSelectionRef = useRef(null);
  const hoverFrameRef = useRef(null);
  const pendingHoverClientXRef = useRef(null);
  const [hoverTime, setHoverTime] = useState(null);
  const [dragState, setDragState] = useState(null);
  const usesOpenCut = resolveScheduleRecipeVariant('timeline', variant, {
    [SCHEDULE_RECIPE_VARIANTS.timeline.FRAMED_TRACK]: () => false,
    [SCHEDULE_RECIPE_VARIANTS.timeline.OPEN_CUT]: () => true,
  });
  const colors = visualTokens;

  const setDraggingActive = (active) => {
    if (typeof onDragStatusChange === 'function') onDragStatusChange(active);
  };

  const stageHighlight = colors.stageHighlight;
  const stageDepth = colors.stageDepth;
  const stageEdge = colors.stageEdge;
  const stageRidge = colors.stageRidge;
  const canvas = colors.canvas;
  const timeFieldSurface = colors.timeFieldSurface;
  const accent = colors.relaxationWash;
  const accentInk = colors.relaxationInk;
  const focusMarker = colors.focusMarker;
  const muted = colors.inkMuted;
  const ink = colors.inkPrimary;
  const shadowInk = colors.shadowInk;
  const timeFontFamily = typography.time;
  const trackTextureImage = timelinePolicy.textureImage;
  const trackTextureOpacity = timelinePolicy.textureOpacity;
  const nowNeedleColor = colors.currentMarker;
  const nowDate = new Date(Number.isFinite(nowTs) ? nowTs : Date.now());
  const nowMinute = nowDate.getHours() * 60 + nowDate.getMinutes();
  const resolvedResetHour = Number.isFinite(Number(resetHour))
    ? Math.min(23, Math.max(0, Math.floor(Number(resetHour))))
    : 4;
  const resetMinuteOffset = resolvedResetHour * 60;
  const resolvedVisibleDays = React.useMemo(
    () => normalizeDays(visibleDays, [0, 1, 2, 3, 4, 5, 6]),
    [visibleDays],
  );
  const resolvedCreationDays = React.useMemo(
    () => normalizeDays(creationDays, resolvedVisibleDays),
    [creationDays, resolvedVisibleDays],
  );

  const toDisplayMinute = (rawMinute) => {
    const safe = Math.max(0, Math.min(MINUTES_IN_DAY, Number(rawMinute) || 0));
    const shifted = ((safe - resetMinuteOffset) % MINUTES_IN_DAY + MINUTES_IN_DAY) % MINUTES_IN_DAY;
    if (safe === MINUTES_IN_DAY && shifted === 0) return MINUTES_IN_DAY;
    return shifted;
  };

  const toRawMinute = (displayMinute) => {
    const safe = Math.max(0, Math.min(MINUTES_IN_DAY, Number(displayMinute) || 0));
    return (safe + resetMinuteOffset) % MINUTES_IN_DAY;
  };

  const normalizeCircularDelta = (origin, target) => {
    if (!Number.isFinite(origin) || !Number.isFinite(target)) return 0;
    let delta = target - origin;
    if (delta > MINUTES_IN_DAY / 2) delta -= MINUTES_IN_DAY;
    if (delta < -MINUTES_IN_DAY / 2) delta += MINUTES_IN_DAY;
    return delta;
  };

  const wrapMinuteRange = (value) => {
    if (!Number.isFinite(value)) return 0;
    return ((value % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  };

  const toDisplaySegments = (block) => getTimelineSegments(block, resolvedResetHour);

  const getMinutesFromClientX = (clientX, { clampCreationStart = false } = {}) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const snappedDisplayMinute = Math.round((fraction * MINUTES_IN_DAY) / STEP_MINUTES) * STEP_MINUTES;
    const displayMinute = clampCreationStart
      ? Math.min(MINUTES_IN_DAY - STEP_MINUTES, snappedDisplayMinute)
      : snappedDisplayMinute;
    return toRawMinute(displayMinute);
  };

  const getMinutesFromEvent = (event, options) => (
    getMinutesFromClientX(event.clientX, options)
  );

  const queueHoverPreview = (clientX) => {
    pendingHoverClientXRef.current = Number.isFinite(clientX) ? clientX : null;
    if (hoverFrameRef.current !== null) return;
    hoverFrameRef.current = requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const pendingClientX = pendingHoverClientXRef.current;
      const nextHoverTime = pendingClientX === null
        ? null
        : getMinutesFromClientX(pendingClientX, { clampCreationStart: true });
      setHoverTime((current) => (current === nextHoverTime ? current : nextHoverTime));
    });
  };

  const buildBlockCreation = React.useCallback((minutes) => {
    if (!activeSchedule || !Array.isArray(activeSchedule.blocks)) return null;
    const base = editorPreviewBlock ? {
      ...activeSchedule,
      blocks: activeSchedule.blocks.map((block) => block.id === editorPreviewBlock.id ? editorPreviewBlock : block),
    } : activeSchedule;
    return addScheduleBlockAtTime(base, minutes, {
      duration: 60,
      minGap: INPUT_MIN_GAP,
      preference: 'closest',
      days: resolvedCreationDays,
    });
  }, [activeSchedule, editorPreviewBlock, resolvedCreationDays]);

  const resolveMagneticMinute = React.useCallback((targetMinute, excludedBlockId = null) => {
    if (!Number.isFinite(targetMinute)) return targetMinute;
    const SNAP_MAGNET_THRESHOLD = 8;
    const candidateBlocks = (activeSchedule?.blocks || []).filter(
      (b) => b.id !== excludedBlockId && doesBlockApplyToDays(b, resolvedVisibleDays) && b.allDay !== true
    );
    const magnetPoints = [nowMinute];
    for (const b of candidateBlocks) {
      if (Number.isFinite(b.startMin)) magnetPoints.push(b.startMin);
      if (Number.isFinite(b.endMin)) magnetPoints.push(b.endMin);
    }
    let closest = null;
    let minDiff = Infinity;
    for (const point of magnetPoints) {
      let diff = Math.abs(targetMinute - point);
      if (diff > MINUTES_IN_DAY / 2) diff = Math.abs(diff - MINUTES_IN_DAY);
      if (diff <= SNAP_MAGNET_THRESHOLD && diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }
    return closest !== null ? closest : targetMinute;
  }, [activeSchedule?.blocks, nowMinute, resolvedVisibleDays]);

  const previewSchedule = React.useMemo(() => {
    if (!dragState || !activeSchedule || !Array.isArray(activeSchedule.blocks)) return activeSchedule;
    const baseSchedule = dragState.baseSchedule || activeSchedule;
    if (!baseSchedule.blocks.some((block) => block.id === dragState.blockId)) return baseSchedule;
    if (!Number.isFinite(dragState.currentMinutes)) return baseSchedule;

    if (dragState.type === 'resize') {
      const magnetMinutes = resolveMagneticMinute(dragState.currentMinutes, dragState.blockId);
      return updateBlockTime(
        baseSchedule,
        dragState.blockId,
        dragState.handle === 'start',
        magnetMinutes,
        { snap: true, minGap: INPUT_MIN_GAP },
      );
    }

    const rawDelta = Number.isFinite(dragState.cumulativeDelta)
      ? dragState.cumulativeDelta
      : normalizeCircularDelta(dragState.originTime, dragState.currentMinutes);
    const snappedDelta = Math.round(rawDelta / STEP_MINUTES) * STEP_MINUTES;
    const rawTargetStart = wrapMinuteRange(dragState.initialStart + snappedDelta);
    const targetStart = resolveMagneticMinute(rawTargetStart, dragState.blockId);
    return moveBlockTime(
      baseSchedule,
      dragState.blockId,
      targetStart,
      {
        snap: true,
        preference: snappedDelta > 0 ? 'at_or_before' : (snappedDelta < 0 ? 'at_or_after' : 'closest'),
      },
    );
  }, [activeSchedule, dragState, resolveMagneticMinute]);

  const handleTrackPointerDown = (event) => {
    if (!trackRef.current || !activeSchedule || !Array.isArray(activeSchedule.blocks)) return;
    if (event.button !== 0) return;
    const startMinute = getMinutesFromEvent(event, { clampCreationStart: true });
    const created = buildBlockCreation(startMinute);
    if (!created?.added || !created?.blockId) return;
    const block = created.schedule.blocks.find((candidate) => candidate.id === created.blockId);
    if (!block) return;

    pendingSelectionRef.current = created.blockId;
    onDraftChange?.(created.schedule);
    onSelectBlock?.(created.blockId);
    setDraggingActive(true);
    setDragState({
      type: 'resize',
      isNew: true,
      activated: true,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      blockId: created.blockId,
      baseSchedule: created.schedule,
      handle: 'end',
      originTime: block.endMin,
      currentMinutes: block.endMin,
      initialStart: block.startMin,
      initialEnd: block.endMin,
    });
  };

  const handleBlockPointerDown = (event, block, handle = null) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    if (block.allDay === true) {
      onSelectBlock?.(block.id);
      return;
    }

    const minute = getMinutesFromEvent(event);
    onSelectBlock?.(block.id);
    pendingSelectionRef.current = selectedBlockId === block.id ? null : block.id;
    setDragState({
      type: handle ? 'resize' : 'move',
      activated: false,
      pointerId: event.pointerId,
      originClientX: event.clientX,
      blockId: block.id,
      baseSchedule: editorPreviewBlock ? {
        ...activeSchedule,
        blocks: activeSchedule.blocks.map((candidate) => candidate.id === editorPreviewBlock.id ? editorPreviewBlock : candidate),
      } : activeSchedule,
      handle,
      originTime: minute,
      currentMinutes: minute,
      lastMinutes: minute,
      cumulativeDelta: 0,
      initialStart: block.startMin,
      initialEnd: block.endMin,
    });
  };

  useEffect(() => {
    if (!dragState) return undefined;
    const handlePointerMove = (event) => {
      if (Number.isFinite(dragState.pointerId) && event.pointerId !== dragState.pointerId) return;
      if (
        dragState.isNew !== true
        && dragState.activated !== true
        && Math.abs(event.clientX - dragState.originClientX) < DRAG_ACTIVATION_DISTANCE_PX
      ) return;
      if (dragState.isNew !== true && dragState.activated !== true) setDraggingActive(true);
      const currentMinutes = getMinutesFromEvent(event);
      setDragState((current) => {
        if (!current) return current;
        if (current.type !== 'move') return { ...current, activated: true, currentMinutes };
        const previousMinutes = Number.isFinite(current.lastMinutes)
          ? current.lastMinutes
          : current.originTime;
        return {
          ...current,
          activated: true,
          currentMinutes,
          lastMinutes: currentMinutes,
          cumulativeDelta: (Number.isFinite(current.cumulativeDelta) ? current.cumulativeDelta : 0)
            + normalizeCircularDelta(previousMinutes, currentMinutes),
        };
      });
    };
    const handlePointerUp = (event) => {
      if (Number.isFinite(dragState.pointerId) && event.pointerId !== dragState.pointerId) return;
      const pendingSelection = pendingSelectionRef.current;
      const interactionActivated = dragState.isNew === true || dragState.activated === true;
      const shouldCommit = interactionActivated && !!previewSchedule && (
        dragState.isNew === true || !areSchedulesEqual(previewSchedule, dragState.baseSchedule)
      );
      pendingSelectionRef.current = null;
      if (shouldCommit) onCommit?.(previewSchedule);
      else if (interactionActivated) onDraftChange?.(null);
      setDragState(null);
      setDraggingActive(false);
      if (pendingSelection) requestAnimationFrame(() => onSelectBlock?.(pendingSelection));
    };
    const cancelPointerInteraction = () => {
      pendingSelectionRef.current = null;
      if (dragState.isNew === true || dragState.activated === true) onDraftChange?.(null);
      setDragState(null);
      setDraggingActive(false);
    };
    const handlePointerCancel = (event) => {
      if (Number.isFinite(dragState.pointerId) && event.pointerId !== dragState.pointerId) return;
      cancelPointerInteraction();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('blur', cancelPointerInteraction);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('blur', cancelPointerInteraction);
    };
  }, [dragState, onCommit, onDraftChange, onSelectBlock, previewSchedule]);

  useEffect(() => () => {
    if (hoverFrameRef.current !== null) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = null;
    }
    if (typeof onDragStatusChange === 'function') onDragStatusChange(false);
    onDraftChange?.(null);
  }, [onDraftChange, onDragStatusChange]);

  const dragActivated = dragState?.isNew === true || dragState?.activated === true;
  const displaySchedule = dragActivated ? previewSchedule : activeSchedule;
  const allBlocks = React.useMemo(() => displaySchedule.blocks.map((block) => (
    editorPreviewBlock?.id === block.id && !dragActivated ? editorPreviewBlock : block
  )), [displaySchedule, editorPreviewBlock, dragActivated]);
  const visibleBlocks = React.useMemo(
    () => allBlocks.filter((block) => doesBlockApplyToDays(block, resolvedVisibleDays)),
    [allBlocks, resolvedVisibleDays],
  );
  const draggedBlock = dragActivated && dragState?.blockId
    ? allBlocks.find((block) => block.id === dragState.blockId) || null
    : null;
  useEffect(() => {
    onInteractionPreview?.(draggedBlock ? { block: draggedBlock, field: dragState.handle || 'move' } : null);
  }, [draggedBlock, dragState?.handle, onInteractionPreview]);
  useEffect(() => () => onInteractionPreview?.(null), [onInteractionPreview]);
  const hoverCandidateBlock = React.useMemo(() => {
    if (
      hoverTime === null
      || dragState
      || !activeSchedule
      || !Array.isArray(activeSchedule.blocks)
    ) return null;
    const created = buildBlockCreation(hoverTime);
    if (!created?.added || !created?.blockId) return null;
    return created.schedule.blocks.find((block) => block.id === created.blockId) || null;
  }, [activeSchedule, buildBlockCreation, dragState, hoverTime]);
  const nowLeft = (toDisplayMinute(nowMinute) / MINUTES_IN_DAY) * 100;
  const hoverDisplaySegments = hoverCandidateBlock ? toDisplaySegments(hoverCandidateBlock) : [];
  const hoverDisplayMinute = hoverDisplaySegments[0]?.start ?? null;
  const hoverEndDisplayMinute = hoverDisplaySegments.at(-1)?.end ?? null;
  const showCreationPreview = !dragState && hoverCandidateBlock !== null;
  const showEmptyAction = showInlineEmptyAction
    && isFirstBlockGuide
    && visibleBlocks.length === 0
    && !dragState;
  const nowMetaTransform = nowLeft < 14
    ? 'translateX(0)'
    : (nowLeft > 86 ? 'translateX(-100%)' : 'translateX(-50%)');
  // F7 section-cut grammar: the deep time field is one flat declared surface, not a lacquered sweep.
  const openCutTimeFieldBackground = stageDepth;

  const handleInlineAddWindow = (event) => {
    event.stopPropagation();
    if (typeof onAddBlock !== 'function') {
      throw new Error('SCHEDULE_TIMELINE_ADD_HANDLER_REQUIRED');
    }
    const result = onAddBlock({ days: resolvedCreationDays });
    if (!result?.blockId || typeof document === 'undefined') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelector('[data-schedule-field="time"]')?.focus();
    }));
  };

  return (
    <div data-schedule-track className={`relative min-w-0 ${usesOpenCut ? 'min-h-[9.125rem]' : 'min-h-[7rem]'}`}>
      <span className="pointer-events-none absolute -top-[19px] z-30 text-[9px] tabular-nums"
        style={{ left: `${nowLeft}%`, transform: nowMetaTransform, color: nowNeedleColor, fontFamily: timeFontFamily }}>
        {minToTime(nowMinute)}
      </span>
      <div
        data-schedule-cut-rail={usesOpenCut ? 'open' : undefined}
        data-schedule-timeline-variant={variant}
        className={`relative w-full overflow-visible ${usesOpenCut ? 'h-[9.125rem]' : 'h-[7rem]'}`}
      >
        {usesOpenCut ? (
          <>
            {/* Narrow dark upper occlusion, exposing the section cut */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-[6] h-[4px]"
              style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${shadowInk} 35%, transparent), transparent)` }}
            />
            {/* Thin lower reflected edge */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-px"
              style={{ backgroundColor: `color-mix(in srgb, ${stageHighlight} 68%, transparent)` }}
            />
            {/* Thin, asymmetric end-depth marks -- no four-sided border */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-[7] w-px"
              style={{ backgroundColor: `color-mix(in srgb, ${stageEdge} 32%, transparent)` }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-[7] w-px"
              style={{ backgroundColor: `color-mix(in srgb, ${stageHighlight} 48%, transparent)` }}
            />
          </>
        ) : null}

        <div
          ref={trackRef}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={(event) => {
            if (dragState) return;
            if (event.target?.closest?.('[data-schedule-block-id], [data-schedule-empty-action]')) {
              queueHoverPreview(null);
              return;
            }
            queueHoverPreview(event.clientX);
          }}
          onPointerLeave={() => {
            if (!dragState) queueHoverPreview(null);
          }}
          data-schedule-time-field
          data-empty={isFirstBlockGuide && visibleBlocks.length === 0 ? 'true' : 'false'}
          className={`group absolute inset-x-0 inset-y-0 cursor-crosshair select-none overflow-visible ${usesOpenCut ? '' : 'rounded-lg border'}`}
          style={{
            background: usesOpenCut ? openCutTimeFieldBackground : timeFieldSurface,
            borderColor: usesOpenCut
              ? 'transparent'
              : `color-mix(in srgb, ${stageEdge} 66%, transparent)`,
            boxShadow: usesOpenCut
              ? 'none'
              : `inset 0 0 0 1px ${translucent(accent, 12.5)}`,
          }}
        >
        {trackTextureImage !== null && trackTextureOpacity > 0 ? (
          <div
            className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]"
            style={{
              backgroundImage: trackTextureImage,
              backgroundSize: timelinePolicy.textureSize === null
                ? undefined
                : timelinePolicy.textureSize,
              opacity: trackTextureOpacity,
              mixBlendMode: timelinePolicy.textureBlendMode,
            }}
          />
        ) : null}

        {usesOpenCut ? <ZenScheduleSandSurface seed={surfaceSeed} highlight={stageHighlight} ridge={stageRidge} /> : null}

        <div
          className="pointer-events-none absolute inset-0 z-[3] grid grid-cols-6"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <span
              key={index}
              className="border-r last:border-r-0"
              style={{ borderColor: translucent(stageRidge, usesOpenCut ? (showEmptyAction ? 5 : 11) : 14) }}
            />
          ))}
        </div>

        {/* Selection and the current instant are measurement annotations: a precise line and tick. */}
        <div className="pointer-events-none absolute inset-y-0 z-30 w-px" style={{ left: `${nowLeft}%`, backgroundColor: nowNeedleColor }}>
          <span
            className="absolute -top-0.5 left-1/2 h-1 w-1 rounded-full -translate-x-1/2"
            style={{ backgroundColor: nowNeedleColor }}
          />
        </div>

        {showEmptyAction ? (
          <div className="pointer-events-none absolute inset-0 z-[32] flex items-center justify-center">
            <button
              type="button"
              data-schedule-add-window
              data-schedule-empty-action
              onPointerDown={(event) => event.stopPropagation()}
              onClick={handleInlineAddWindow}
              className="pointer-events-auto relative flex h-10 items-center justify-center gap-1.5 rounded-full border px-5 text-[10px] font-semibold tracking-[0.07em] transition-[transform,translate,scale,rotate,box-shadow,background-color,border-color] duration-200 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 motion-reduce:transition-none"
              style={{
                borderColor: `color-mix(in srgb, ${focusMarker} 30%, ${stageEdge})`,
                backgroundColor: `color-mix(in srgb, ${stageHighlight} 76%, ${timeFieldSurface})`,
                boxShadow: `0 2px 7px color-mix(in srgb, ${shadowInk} 7%, transparent), inset 0 1px 0 color-mix(in srgb, ${stageHighlight} 86%, transparent)`,
                color: accentInk,
                outlineColor: focusMarker,
              }}
            >
              <span aria-hidden="true" className="text-[13px] font-light">＋</span>
              <span>{t('workbench.add_window')}</span>
            </button>
          </div>
        ) : null}

        {showCreationPreview ? (
          <>
            {hoverDisplaySegments.map((segment) => (
              <span
                key={`${segment.start}-${segment.end}`}
                className="pointer-events-none absolute inset-y-0 z-10"
                style={{
                  left: `${(segment.start / MINUTES_IN_DAY) * 100}%`,
                  width: `${((segment.end - segment.start) / MINUTES_IN_DAY) * 100}%`,
                  backgroundColor: translucent(accent, 5),
                }}
              />
            ))}
            <span
              className="pointer-events-none absolute inset-y-0 z-10 w-px"
              style={{
                left: `${(hoverDisplayMinute / MINUTES_IN_DAY) * 100}%`,
                backgroundColor: translucent(focusMarker, 32),
              }}
            />
            <span
              className="pointer-events-none absolute inset-y-0 z-10 w-px"
              style={{
                left: `${(hoverEndDisplayMinute / MINUTES_IN_DAY) * 100}%`,
                backgroundColor: translucent(accentInk, 24),
              }}
            />
          </>
        ) : null}

        {visibleBlocks.flatMap((block) => {
          const selected = block.id === selectedBlockId;
          const blockAccent = block.intent === 'isolation' ? colors.isolationInk : accent;
          const modeLabel = t(block.intent === 'isolation' ? 'modes.isolation' : 'modes.relaxation');
          const segments = toDisplaySegments(block);
          const labelSegmentIndex = segments.reduce((bestIndex, segment, index, allSegments) => (
            (segment.end - segment.start) > (allSegments[bestIndex].end - allSegments[bestIndex].start)
              ? index
              : bestIndex
          ), 0);
          const isMultiSegment = segments.length > 1;

          return segments.map((segment, segmentIndex) => {
            const left = (segment.start / MINUTES_IN_DAY) * 100;
            const width = Math.max(0.1, ((segment.end - segment.start) / MINUTES_IN_DAY) * 100);
            const hasStartEndpoint = segmentIndex === 0;
            const hasEndEndpoint = segmentIndex === segments.length - 1;
            const isSemanticSegment = segmentIndex === 0;
            const SegmentElement = isSemanticSegment ? 'button' : 'span';
            const isNarrow = width < 4.2;
            const isMicro = width < 2.4;

            const timeText = block.allDay === true
              ? t('rhythm.all_day')
              : `${minToTime(block.startMin)}–${minToTime(block.endMin)}`;
            const displayName = block.name || timeText;

            return (
              <SegmentElement
                key={`${block.id}-${segmentIndex}`}
                onPointerDown={(event) => handleBlockPointerDown(event, block)}
                type={isSemanticSegment ? 'button' : undefined}
                data-schedule-block-id={block.id}
                data-schedule-intent={block.intent}
                data-schedule-selected={selected ? 'true' : 'false'}
                title={`${modeLabel} · ${block.name ? `${block.name} (${timeText})` : timeText}`}
                aria-label={isSemanticSegment
                  ? (block.allDay === true
                    ? `${modeLabel}, ${block.name || t('rhythm.all_day')}`
                    : `${modeLabel}, ${block.name ? `${block.name}, ` : ''}${minToTime(block.startMin)}–${minToTime(block.endMin)}`)
                  : undefined}
                aria-pressed={isSemanticSegment ? selected : undefined}
                aria-controls={isSemanticSegment ? 'schedule-block-workbench' : undefined}
                aria-hidden={isSemanticSegment ? undefined : true}
                tabIndex={isSemanticSegment ? 0 : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.detail === 0) onSelectBlock?.(block.id);
                }}
                className={`absolute z-20 p-0 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 ${block.allDay === true ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${usesOpenCut ? 'overflow-visible border-x' : 'overflow-hidden border'}`}
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  top: 0,
                  bottom: 0,
                  borderRadius: usesOpenCut ? 0 : '4px',
                  borderColor: selected ? focusMarker : (usesOpenCut ? `color-mix(in srgb, ${blockAccent} 55%, ${colors.stageEdge})` : translucent(blockAccent, 45)),
                  // Relaxation windows do not add a raised plane; they modulate the field's
                  // full height with one flat translucent wash, idle vs. selected by opacity only.
                  background: translucent(blockAccent, selected ? timelinePolicy.selectedBlockOpacity : timelinePolicy.idleBlockOpacity),
                  boxShadow: 'none',
                  outlineColor: focusMarker,
                  opacity: dragActivated && dragState?.blockId === block.id ? 0.9 : 1,
                }}
              >
                {segmentIndex === labelSegmentIndex ? (
                  <span
                    className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] font-medium"
                    style={{
                      left: hasStartEndpoint && block.allDay !== true ? '9px' : '6px',
                      right: hasEndEndpoint && block.allDay !== true ? '9px' : '6px',
                      color: ink,
                    }}
                  >
                    {isMicro ? null : (isNarrow ? (block.name || minToTime(block.startMin)) : displayName)}
                  </span>
                ) : null}

                {isMultiSegment ? (
                  segment.end === MINUTES_IN_DAY ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-0 top-0 bottom-0 w-1 border-r border-dashed opacity-50"
                      style={{ borderColor: focusMarker }}
                    />
                  ) : segment.start === 0 ? (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 top-0 bottom-0 w-1 border-l border-dashed opacity-50"
                      style={{ borderColor: focusMarker }}
                    />
                  ) : null
                ) : null}

                {block.allDay !== true && hasStartEndpoint ? (
                  <span
                    aria-hidden="true"
                    data-schedule-resize-handle="start"
                    onPointerDown={(event) => handleBlockPointerDown(event, block, 'start')}
                    className="group/handle absolute inset-y-0 left-0 z-30 flex items-center justify-start cursor-ew-resize pl-0.5"
                    style={{ width: ENDPOINT_HIT_WIDTH }}
                  >
                    <span
                      className="h-3 w-0.5 rounded-full opacity-35 transition-opacity group-hover/handle:opacity-100"
                      style={{ backgroundColor: selected ? focusMarker : accentInk }}
                    />
                  </span>
                ) : null}
                {block.allDay !== true && hasEndEndpoint ? (
                  <span
                    aria-hidden="true"
                    data-schedule-resize-handle="end"
                    onPointerDown={(event) => handleBlockPointerDown(event, block, 'end')}
                    className="group/handle absolute inset-y-0 right-0 z-30 flex items-center justify-end cursor-ew-resize pr-0.5"
                    style={{ width: ENDPOINT_HIT_WIDTH }}
                  >
                    <span
                      className="h-3 w-0.5 rounded-full opacity-35 transition-opacity group-hover/handle:opacity-100"
                      style={{ backgroundColor: selected ? focusMarker : accentInk }}
                    />
                  </span>
                ) : null}
                {usesOpenCut ? (
                  <>
                    {hasStartEndpoint ? (
                      <span
                        data-schedule-boundary="start"
                        className="pointer-events-none absolute inset-y-0 left-0 w-px"
                        style={{ backgroundColor: selected ? focusMarker : translucent(accentInk, 22) }}
                      />
                    ) : null}
                    {hasEndEndpoint ? (
                      <span
                        data-schedule-boundary="end"
                        className="pointer-events-none absolute inset-y-0 right-0 w-px"
                        style={{ backgroundColor: selected ? focusMarker : translucent(accentInk, 22) }}
                      />
                    ) : null}
                    {selected && block.allDay !== true ? (
                      <>
                        {hasStartEndpoint ? (
                          <span className="pointer-events-none absolute left-0 top-0 h-px" style={{ width: 'min(8px, 20%)', backgroundColor: focusMarker }} />
                        ) : null}
                        {hasEndEndpoint ? (
                          <span className="pointer-events-none absolute right-0 top-0 h-px" style={{ width: 'min(8px, 20%)', backgroundColor: focusMarker }} />
                        ) : null}
                      </>
                    ) : null}
                  </>
                ) : selected && block.allDay !== true ? (
                  <>
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-px" style={{ backgroundColor: focusMarker }} />
                    <span className="pointer-events-none absolute inset-y-0 right-0 w-px" style={{ backgroundColor: focusMarker }} />
                    <span className="pointer-events-none absolute left-0 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ borderColor: focusMarker, backgroundColor: canvas }} />
                    <span className="pointer-events-none absolute right-0 top-1/2 h-2 w-2 translate-x-1/2 -translate-y-1/2 rounded-full border" style={{ borderColor: focusMarker, backgroundColor: canvas }} />
                  </>
                ) : null}
              </SegmentElement>
            );
          });
        })}

        {showCreationPreview ? (
          <span
            className="pointer-events-none absolute -top-6 z-40 -translate-x-1/2 text-[10px] font-semibold tabular-nums"
            style={{ left: `${(hoverDisplayMinute / MINUTES_IN_DAY) * 100}%`, color: ink, fontFamily: timeFontFamily }}
          >
            {minToTime(hoverCandidateBlock.startMin)}
          </span>
        ) : null}
      </div>
      </div>


    </div>
  );
}

export default React.memo(TimelineTrack);
