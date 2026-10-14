import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  SCHEDULE_RECIPE_VARIANTS,
  resolveScheduleRecipeVariant,
} from '../../../../../themes/core/scheduleVisualPolicy.js';
import {
  MINUTES_IN_DAY,
  SCHEDULE_SCOPE_GROUPS,
  areDaySetsEqual,
  doesBlockApplyToDays,
  getBlockDuration,
} from '../scheduleModel.js';
import { buildDurationCopyDescriptor } from '../utils.js';
import { getPrimaryTimelineSegmentIndex, getTimelineSegments } from '../scheduleTimelineGeometry.js';
import { useScheduleWorkbenchPlacement } from '../useScheduleWorkbenchPlacement.js';
import TimelineTrack from './TimelineTrack.jsx';
import ScheduleRhythmIdentity from './ScheduleRhythmIdentity.jsx';
import ScheduleBlockWorkbench from './ScheduleBlockWorkbench.jsx';

export const SCHEDULE_RHYTHM_PAGES = Object.freeze([
  Object.freeze({ id: 'rhythm-1', days: SCHEDULE_SCOPE_GROUPS.weekday.days, displayDays: [1, 2, 3, 4, 5] }),
  Object.freeze({ id: 'rhythm-2', days: SCHEDULE_SCOPE_GROUPS.weekend.days, displayDays: [6, 0] }),
]);

function resolveRhythmForBlock(block) {
  if (!block) return null;
  return SCHEDULE_RHYTHM_PAGES.find((rhythm) => areDaySetsEqual(block.days, rhythm.days)) || null;
}

function resolveRhythmForDay(day) {
  return SCHEDULE_RHYTHM_PAGES.find((rhythm) => rhythm.days.includes(day)) || SCHEDULE_RHYTHM_PAGES[0];
}

function ScheduleTimeRuler({ resetHour, visualTokens, typography }) {
  const safeResetHour = Number.isFinite(Number(resetHour))
    ? Math.min(23, Math.max(0, Math.floor(Number(resetHour))))
    : 4;
  const labels = Array.from({ length: 7 }, (_, index) => (safeResetHour + index * 4) % 24);
  const muted = visualTokens.inkMuted;
  const ridge = visualTokens.stageRidge;
  const focus = visualTokens.focusMarker;

  return (
    <div className="schedule-time-ruler" aria-hidden="true">
      <div className="flex items-end justify-between px-px">
        {labels.map((hour, index) => (
          <span
            key={`${hour}-${index}`}
            className={`text-[9px] font-medium tabular-nums ${index === 0 ? '' : index === labels.length - 1 ? '' : '-translate-x-1/2'}`}
            style={{
              color: muted,
              fontFamily: typography.time,
            }}
          >
            {String(hour).padStart(2, '0')}:00
          </span>
        ))}
      </div>
      <div className="relative mt-1.5 h-1.5 w-full">
        {Array.from({ length: 25 }, (_, i) => {
          const isMajor = i % 4 === 0;
          const currentHour = (safeResetHour + i) % 24;
          const isMidnight = currentHour === 0;
          return (
            <span
              key={i}
              className="absolute bottom-0 -translate-x-1/2 transition-opacity duration-150"
              style={{
                left: `${(i / 24) * 100}%`,
                width: isMidnight ? '2px' : '1px',
                height: isMajor ? (isMidnight ? '5.5px' : '4px') : '2px',
                backgroundColor: isMidnight
                  ? `color-mix(in srgb, ${focus} 75%, ${ridge})`
                  : (isMajor
                    ? `color-mix(in srgb, ${ridge} 42%, transparent)`
                    : `color-mix(in srgb, ${muted} 20%, transparent)`),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function ScheduleRhythmWorkspace({
  activeSchedule,
  selectedBlockId,
  canUndo = false,
  handlers,
  visualTokens,
  typography,
  recipes,
  timelinePolicy,
  nowTs,
  resetHour,
  dayLabels,
  currentStatus = null,
  notificationControl = null,
  specialSessionWorkbench = null,
  workbenchMode = 'recurring',
  onWorkbenchModeChange,
  workbenchActionsRef,
  allowedUrls = [],
  onManageSites,
  t,
}) {
  const usesEdgeToEdgeShell = resolveScheduleRecipeVariant('shell', recipes.shell, {
    [SCHEDULE_RECIPE_VARIANTS.shell.EDGE_TO_EDGE]: () => true,
    [SCHEDULE_RECIPE_VARIANTS.shell.FRAMED]: () => false,
  });
  const usesOpenCutTimeline = resolveScheduleRecipeVariant('timeline', recipes.timeline, {
    [SCHEDULE_RECIPE_VARIANTS.timeline.FRAMED_TRACK]: () => false,
    [SCHEDULE_RECIPE_VARIANTS.timeline.OPEN_CUT]: () => true,
  });
  const usesAttachedPaper = resolveScheduleRecipeVariant('workbench', recipes.workbench, {
    [SCHEDULE_RECIPE_VARIANTS.workbench.ATTACHED_PAPER]: () => true,
    [SCHEDULE_RECIPE_VARIANTS.workbench.STANDARD_PANEL]: () => false,
  });
  const placesStatusInStage = resolveScheduleRecipeVariant('status', recipes.status, {
    [SCHEDULE_RECIPE_VARIANTS.status.PAGE_HEADER]: () => false,
    [SCHEDULE_RECIPE_VARIANTS.status.STAGE_META]: () => true,
  });
  const supportsInlineEmptyAction = usesOpenCutTimeline && usesAttachedPaper;
  const blocks = Array.isArray(activeSchedule?.blocks) ? activeSchedule.blocks : [];
  const selectedBlock = selectedBlockId
    ? blocks.find((block) => block.id === selectedBlockId) || null
    : null;
  const todayDay = new Date(Number.isFinite(nowTs) ? nowTs : Date.now()).getDay();
  const [activeRhythmId, setActiveRhythmId] = useState(() => resolveRhythmForDay(todayDay).id);
  const activeRhythm = useMemo(
    () => SCHEDULE_RHYTHM_PAGES.find((rhythm) => rhythm.id === activeRhythmId) || SCHEDULE_RHYTHM_PAGES[0],
    [activeRhythmId],
  );
  const rhythmBlockCounts = useMemo(() => Object.fromEntries(
    SCHEDULE_RHYTHM_PAGES.map((rhythm) => [
      rhythm.id,
      blocks.reduce((count, block) => (
        count + (doesBlockApplyToDays(block, rhythm.days) ? 1 : 0)
      ), 0),
    ]),
  ), [blocks]);
  const activeRhythmBlockCount = rhythmBlockCounts[activeRhythm.id] || 0;
  const centersEmptyActionInTimeline = supportsInlineEmptyAction && activeRhythmBlockCount === 0;
  const selectedRhythm = resolveRhythmForBlock(selectedBlock) || activeRhythm;
  const [editingPreview, setEditingPreview] = useState(null);
  const [interactionPreview, setInteractionPreview] = useState(null);
  const editorActionsRef = useRef(null);
  useImperativeHandle(workbenchActionsRef, () => ({ commit: () => editorActionsRef.current?.commit() }));
  const fieldRef = useRef(null);
  const [sandSeed] = useState(() => Math.floor(Math.random() * 0xffffffff));
  const rejectedPointerRef = useRef(false);
  const handleEditingChange = useCallback((preview) => setEditingPreview(preview), []);
  const handleInteractionPreview = useCallback((preview) => setInteractionPreview(preview), []);
  const handleSelectBlock = useCallback((id) => {
    if (editorActionsRef.current?.commit() === false) return;
    onWorkbenchModeChange?.('recurring');
    handlers.onSelectBlock(id);
  }, [handlers.onSelectBlock, onWorkbenchModeChange]);
  // Opening options changes endpoint focus, but retains the same pending interval.
  const editorPreviewBlock = editingPreview?.block?.id === selectedBlockId
    ? editingPreview.block : null;
  const visualBlock = interactionPreview?.block || editorPreviewBlock || selectedBlock;
  const editingEndpoint = interactionPreview?.field || editingPreview?.field;
  const bridgeSegments = getTimelineSegments(visualBlock, resetHour);
  const primarySegment = getPrimaryTimelineSegmentIndex(bridgeSegments);
  const editingActive = editingPreview?.active === true && !interactionPreview;
  const placement = useScheduleWorkbenchPlacement(fieldRef, selectedBlockId, bridgeSegments, editingActive);
  const edge = visualTokens.stageEdge;
  const stageSurface = visualTokens.stageSurface;
  const durationCopy = visualBlock ? buildDurationCopyDescriptor(getBlockDuration(visualBlock)) : null;

  useEffect(() => {
    const owningRhythm = resolveRhythmForBlock(selectedBlock);
    if (owningRhythm && owningRhythm.id !== activeRhythmId) setActiveRhythmId(owningRhythm.id);
  }, [activeRhythmId, selectedBlock]);

  const selectRhythm = (rhythmId) => {
    if (rhythmId === activeRhythmId) return;
    if (editorActionsRef.current?.commit() === false) return false;
    handlers.onClearSelection?.();
    setActiveRhythmId(rhythmId);
  };

  const handleRhythmKeyDown = (event, rhythmId) => {
    const currentIndex = SCHEDULE_RHYTHM_PAGES.findIndex((rhythm) => rhythm.id === rhythmId);
    if (currentIndex < 0) return;
    let nextIndex = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % SCHEDULE_RHYTHM_PAGES.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + SCHEDULE_RHYTHM_PAGES.length) % SCHEDULE_RHYTHM_PAGES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = SCHEDULE_RHYTHM_PAGES.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextRhythmId = SCHEDULE_RHYTHM_PAGES[nextIndex].id;
    if (selectRhythm(nextRhythmId) === false) return;
    requestAnimationFrame(() => document.getElementById(`schedule-rhythm-tab-${nextRhythmId}`)?.focus());
  };

  return (
    <section
      data-schedule-rhythm-workspace
      data-schedule-surface
      data-editing-endpoint={editingEndpoint}
      data-schedule-dragging={interactionPreview ? 'true' : 'false'}
      data-schedule-editing={editingActive ? 'true' : 'false'}
      data-attached-paper={usesAttachedPaper ? 'true' : 'false'}
      onPointerDownCapture={(event) => {
        rejectedPointerRef.current = false;
        if (event.target.closest('[data-schedule-editor]')) return;
        if (editorActionsRef.current?.commit() === false) {
          rejectedPointerRef.current = true;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onClickCapture={(event) => {
        if (!rejectedPointerRef.current) return;
        rejectedPointerRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div
        data-schedule-time-stage
        className={`fr-scroll flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain ${usesEdgeToEdgeShell ? 'px-6 py-6' : 'rounded-xl border px-6 pb-5 pt-2'}`}
        style={{
          borderColor: `color-mix(in srgb, ${edge} ${usesEdgeToEdgeShell ? 32 : 40}%, transparent)`,
          // F7: "one flat time stage" -- no radial sheen behind the bookmarks/ruler/timeline.
          background: usesOpenCutTimeline
            ? stageSurface
            : `color-mix(in srgb, ${visualTokens.panelBackground} 44%, transparent)`,
        }}
      >
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <div
            role="tablist"
            aria-label={t('rhythm.identity_label')}
            className={`flex min-w-0 flex-wrap items-end gap-y-2 ${usesOpenCutTimeline ? 'gap-x-1 border-b' : 'gap-x-7'}`}
            style={usesOpenCutTimeline ? {
              borderColor: `color-mix(in srgb, ${edge} 32%, transparent)`,
            } : undefined}
          >
            {SCHEDULE_RHYTHM_PAGES.map((rhythm) => (
              <ScheduleRhythmIdentity
                key={rhythm.id}
                rhythmId={rhythm.id}
                days={rhythm.displayDays}
                dayLabels={dayLabels}
                blockCount={rhythmBlockCounts[rhythm.id] || 0}
                selected={rhythm.id === activeRhythm.id}
                todayDay={todayDay}
                onSelect={selectRhythm}
                onKeyDown={handleRhythmKeyDown}
                visualTokens={visualTokens}
                typography={typography}
                variant={recipes.rhythmIdentity}
                t={t}
              />
            ))}
          </div>
          {placesStatusInStage && currentStatus ? (
            <div data-schedule-current-state role="status" aria-live="polite" aria-atomic="true"
              className="ml-auto flex items-center gap-1.5 text-[10px]" style={{ color: currentStatus.color, fontFamily: typography.label }}>
              <span className="sr-only">{t('status.current_label')}</span>
              <span>{currentStatus.label}</span>
              <span>{currentStatus.detail}</span>
              {currentStatus.actions}
            </div>
          ) : null}
          {!placesStatusInStage ? currentStatus?.actions : null}
        </div>

        <div ref={fieldRef} className={usesOpenCutTimeline ? 'mt-5' : 'mt-4'}>
          <div
            key={activeRhythm.id}
            id={`schedule-rhythm-panel-${activeRhythm.id}`}
            data-schedule-rhythm={activeRhythm.id}
            role="tabpanel"
            aria-labelledby={`schedule-rhythm-tab-${activeRhythm.id}`}
            className="min-w-0"
          >
            <TimelineTrack
              activeSchedule={activeSchedule}
              selectedBlockId={selectedBlockId}
              editorPreviewBlock={editorPreviewBlock}
              onInteractionPreview={handleInteractionPreview}
              onDraftChange={handlers.onDraftChange}
              onCommit={handlers.onCommit}
              onSelectBlock={handleSelectBlock}
              onAddBlock={handlers.onAddBlock}
              visualTokens={visualTokens}
              typography={typography}
              variant={recipes.timeline}
              timelinePolicy={timelinePolicy}
              nowTs={nowTs}
              resetHour={resetHour}
              isFirstBlockGuide={activeRhythmBlockCount === 0}
              showInlineEmptyAction={centersEmptyActionInTimeline}
              visibleDays={activeRhythm.days}
              creationDays={activeRhythm.days}
              surfaceSeed={sandSeed ^ (activeRhythm.id === 'rhythm-1' ? 1 : 2)}
            />
          </div>
          <div className="schedule-selection-bridge" aria-hidden="true" data-measuring={editingEndpoint === 'start' || editingEndpoint === 'end'}
            style={{ '--schedule-bridge-ink': visualTokens.focusMarker, fontFamily: typography.time }}>
              {bridgeSegments.map((segment, index) => (
                <div key={index} className="schedule-selection-imprint" style={{
                  left: `${segment.start / MINUTES_IN_DAY * 100}%`,
                  width: `${(segment.end - segment.start) / MINUTES_IN_DAY * 100}%`,
                }}>
                  {index === 0 ? <span data-schedule-bridge-endpoint="start" /> : null}
                  {index === bridgeSegments.length - 1 ? <span data-schedule-bridge-endpoint="end" /> : null}
                </div>
              ))}
              {visualBlock ? <span className="schedule-duration-label" style={{
                left: `clamp(44px, ${((bridgeSegments[primarySegment].start + bridgeSegments[primarySegment].end) / (2 * MINUTES_IN_DAY)) * 100}%, calc(100% - 44px))`,
                background: stageSurface,
              }}>{t(durationCopy.key, durationCopy.params)}</span> : null}
          </div>
          <ScheduleTimeRuler resetHour={resetHour} visualTokens={visualTokens} typography={typography} />
          <div className="relative shrink-0 schedule-workbench-anchor" data-schedule-workbench-anchor data-schedule-editor
            onKeyDown={(event) => {
              if (event.key !== 'Escape' || workbenchMode !== 'instant' || event.defaultPrevented) return;
              event.preventDefault(); event.stopPropagation();
              onWorkbenchModeChange?.('recurring');
              requestAnimationFrame(() => document.querySelector('[data-schedule-workbench-mode="recurring"]')?.focus());
            }}>
            <div className="mt-5 flex flex-wrap gap-x-5 border-b" style={{ borderColor: edge }}>
              {['recurring', 'instant'].map((mode) => <button key={mode} type="button"
                data-schedule-workbench-mode={mode}
                aria-pressed={workbenchMode === mode} aria-controls={mode === 'instant' ? 'schedule-special-session-panel' : undefined}
                className="min-h-11 border-b-2 px-1 text-sm font-semibold"
                style={{ color: workbenchMode === mode ? visualTokens.inkPrimary : visualTokens.inkMuted,
                  borderColor: workbenchMode === mode ? visualTokens.focusMarker : 'transparent' }}
                onClick={() => {
                  if (editorActionsRef.current?.commit() === false) return;
                  onWorkbenchModeChange?.(mode);
                }}>{t(`workbench.${mode}`)}</button>)}
            </div>
            {workbenchMode === 'recurring' ? <ScheduleBlockWorkbench
              activeSchedule={activeSchedule}
              selectedBlock={interactionPreview?.block || selectedBlock}
              rhythmDays={selectedRhythm.displayDays || selectedBlock?.days || []}
              visualTokens={visualTokens}
              typography={typography}
              variant={recipes.workbench}
              onAddBlock={handlers.onAddBlock}
              onCommit={handlers.onCommit}
              onRemoveBlock={handlers.onRemoveBlock}
              onEditingChange={handleEditingChange}
              actionsRef={editorActionsRef}
              canUndo={canUndo}
              onUndo={handlers.onUndo}
              inlineEmptyAction={centersEmptyActionInTimeline}
              allowedUrls={allowedUrls}
              notificationControl={notificationControl}
              placement={placement}
              onManageSites={onManageSites}
            /> : specialSessionWorkbench}
          </div>
        </div>
      </div>
    </section>
  );
}

export default React.memo(ScheduleRhythmWorkspace);
