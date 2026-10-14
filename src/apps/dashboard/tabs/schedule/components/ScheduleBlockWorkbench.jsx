import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ChevronDown, Trash2, Undo2 } from 'lucide-react';
import { SCHEDULE_RECIPE_VARIANTS, resolveScheduleRecipeVariant } from '@/themes/core/scheduleVisualPolicy.js';
import { INPUT_MIN_GAP, STEP_MINUTES, areSchedulesEqual, editScheduleBlock, minToTime, parseScheduleEditorTime } from '../scheduleModel.js';
import { useAppTranslation } from '../../../../../ui-kit/hooks/useAppTranslation.js';

function draftFromBlock(block) {
  return block ? { start: minToTime(block.startMin), end: minToTime(block.endMin), name: block.name || '' }
    : { start: '', end: '', name: '' };
}

function focusTimelineBlock(blockId) {
  requestAnimationFrame(() => {
    const target = Array.from(document.querySelectorAll('button[data-schedule-block-id]'))
      .find((element) => element.dataset.scheduleBlockId === blockId);
    target?.focus();
  });
}

function ScheduleBlockWorkbench({
  activeSchedule, selectedBlock, rhythmDays = [], visualTokens, typography, variant,
  onAddBlock, onCommit, onRemoveBlock, onEditingChange, actionsRef, canUndo = false, onUndo,
  inlineEmptyAction = false, allowedUrls = [], notificationControl = null,
  placement = null, onManageSites,
}) {
  const { t } = useAppTranslation('schedule');
  const usesAttachedPaper = resolveScheduleRecipeVariant('workbench', variant, {
    [SCHEDULE_RECIPE_VARIANTS.workbench.ATTACHED_PAPER]: () => true,
    [SCHEDULE_RECIPE_VARIANTS.workbench.STANDARD_PANEL]: () => false,
  });
  const [draft, setDraft] = useState(() => draftFromBlock(selectedBlock));
  const [focusedField, setFocusedField] = useState(null);
  const [hasFocus, setHasFocus] = useState(false);
  const [error, setError] = useState(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertError, setAlertError] = useState(null);
  const startInputRef = useRef(null);
  const optionsButtonRef = useRef(null);
  const pendingFocusRef = useRef(false);
  const skipBlurRef = useRef(false);
  const submittedRef = useRef(null);
  const selectionRef = useRef(selectedBlock?.id);
  selectionRef.current = selectedBlock?.id;
  const latestRef = useRef(null);
  const errorId = React.useId();
  const hintId = React.useId();
  const optionsId = React.useId();

  useEffect(() => {
    selectionRef.current = selectedBlock?.id;
    return () => { selectionRef.current = null; };
  }, [selectedBlock?.id]);

  useEffect(() => {
    setDraft(draftFromBlock(selectedBlock));
    setError(null);
    submittedRef.current = null;
    if (pendingFocusRef.current && selectedBlock) {
      pendingFocusRef.current = false;
      requestAnimationFrame(() => startInputRef.current?.focus());
    }
  }, [selectedBlock?.id, selectedBlock?.startMin, selectedBlock?.endMin, selectedBlock?.name]);
  useEffect(() => { setAlertError(null); }, [selectedBlock?.id]);
  useEffect(() => {
    if (notificationControl?.openOnEntry) setOptionsOpen(true);
  }, [notificationControl?.openOnEntry, selectedBlock?.id]);

  const editResult = useMemo(() => {
    if (!selectedBlock) return null;
    const startMin = parseScheduleEditorTime(draft.start);
    const endMin = parseScheduleEditorTime(draft.end, true);
    if (startMin === null || endMin === null) return { error: 'invalid_time' };
    return editScheduleBlock(activeSchedule, selectedBlock.id, { startMin, endMin, name: draft.name });
  }, [activeSchedule, selectedBlock, draft]);
  // Incomplete typing must not sweep a twenty-hour preview across the field.
  const hasCompleteTimes = [draft.start, draft.end].every((value) => /^(?:\d{1,2}:\d{2}|\d{3,4})$/.test(value));
  useEffect(() => {
    onEditingChange?.({ block: hasCompleteTimes ? editResult?.block || null : null, field: focusedField, active: hasFocus });
  }, [editResult, hasCompleteTimes, focusedField, hasFocus, onEditingChange]);

  const restore = () => { setDraft(draftFromBlock(selectedBlock)); setError(null); };
  const commit = () => {
    if (!selectedBlock || !editResult) return true;
    if (editResult.error) { setError(editResult.error); return false; }
    if (!areSchedulesEqual(activeSchedule, editResult.schedule) && !areSchedulesEqual(submittedRef.current, editResult.schedule)) {
      submittedRef.current = editResult.schedule;
      onCommit(editResult.schedule);
    }
    setDraft(draftFromBlock(editResult.block));
    setError(null);
    return true;
  };
  useImperativeHandle(actionsRef, () => ({ commit }));
  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation(); commit();
    } else if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      skipBlurRef.current = true;
      restore();
      focusTimelineBlock(selectedBlock.id);
    }
  };
  const handleTimeKeyDown = (field, event) => {
    handleKeyDown(event);
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    const minutes = parseScheduleEditorTime(draft[field], field === 'end');
    if (minutes === null) return;
    event.preventDefault();
    const next = minutes + (event.key === 'ArrowUp' ? STEP_MINUTES : -STEP_MINUTES);
    change(field, minToTime(Math.max(0, Math.min(field === 'end' ? 1440 : 1430, next))));
  };
  const handleBlur = (event) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setHasFocus(false);
    setFocusedField(null);
    if (skipBlurRef.current) { skipBlurRef.current = false; return; }
    commit();
  };
  const alertsOn = selectedBlock?.notificationMode === 'end' || selectedBlock?.notificationMode === 'both'
    || (selectedBlock?.notificationMode === 'auto' && (notificationControl?.inheritedEnd === true
      || (selectedBlock.intent === 'isolation' && notificationControl?.inheritedStart === true)));
  const alertRule = alertsOn
    ? (selectedBlock.notificationMode === 'auto'
      ? (selectedBlock.intent === 'isolation' && notificationControl.inheritedStart
        ? (notificationControl.inheritedEnd ? 'both' : 'start') : 'end')
      : selectedBlock.notificationMode)
    : (selectedBlock?.intent === 'isolation' ? 'both' : 'end');
  latestRef.current = { activeSchedule, selectedBlock, editResult, draft, onCommit };
  const setMode = (intent) => {
    if (!editResult || editResult.error) { setError(editResult?.error); return; }
    const result = editScheduleBlock(activeSchedule, selectedBlock.id, {
      startMin: editResult.block.startMin, endMin: editResult.block.endMin, name: draft.name, intent,
      notificationMode: alertsOn ? (intent === 'isolation' ? 'both' : 'end') : 'none',
    });
    if (result.error) { setError(result.error); return; }
    submittedRef.current = result.schedule;
    onCommit(result.schedule);
  };
  const toggleAlert = async () => {
    if (!editResult || editResult.error) { setError(editResult?.error); return; }
    const blockId = selectedBlock.id;
    setAlertBusy(true);
    setAlertError(null);
    try {
      if (!alertsOn) {
        if (typeof notificationControl?.ensurePermission !== 'function') throw new Error('SCHEDULE_WINDOW_ALERT_PERMISSION_OWNER_REQUIRED');
        const granted = await notificationControl.ensurePermission();
        if (selectionRef.current !== blockId) return;
        if (!granted) { setAlertError(t('modes.notification_permission')); return; }
      }
      if (selectionRef.current !== blockId) return;
      const latest = latestRef.current;
      if (latest.editResult.error) { setError(latest.editResult.error); return; }
      const result = editScheduleBlock(latest.activeSchedule, blockId, {
        startMin: latest.editResult.block.startMin, endMin: latest.editResult.block.endMin, name: latest.draft.name,
        notificationMode: alertsOn ? 'none' : (latest.selectedBlock.intent === 'isolation' ? 'both' : 'end'),
      });
      if (result.error) { setError(result.error); return; }
      submittedRef.current = result.schedule;
      const acknowledgement = await latest.onCommit(result.schedule);
      if (acknowledgement?.error) throw acknowledgement.error;
    } catch (failure) {
      console.error('[ScheduleWorkbench] Notification opt-in failed:', failure);
      setAlertError(t('modes.notification_error'));
    } finally {
      setAlertBusy(false);
    }
  };
  const add = () => {
    pendingFocusRef.current = true;
    const result = onAddBlock({ days: rhythmDays });
    if (!result?.blockId) pendingFocusRef.current = false;
  };
  const remove = () => {
    const controls = Array.from(document.querySelectorAll('button[data-schedule-block-id]'));
    const index = controls.findIndex((element) => element.dataset.scheduleBlockId === selectedBlock.id);
    const adjacent = controls[index + 1] || controls[index - 1];
    onRemoveBlock(selectedBlock.id);
    requestAnimationFrame(() => (adjacent || document.querySelector('[data-schedule-undo], [data-schedule-add-window]'))?.focus());
  };
  const keepEditingFocus = (event) => event.preventDefault();
  const errorMessages = error ? {
    invalid_time: t('editor.errors.invalid_time'), time_step: t('editor.errors.time_step', { step: STEP_MINUTES }),
    minimum_duration: t('editor.errors.minimum_duration', { minutes: INPUT_MIN_GAP }), overlap: t('editor.errors.overlap'),
  } : null;
  const undoControl = canUndo ? (
    <button type="button" data-schedule-undo className="schedule-editor-undo" title={t('editor.undo')} aria-label={t('editor.undo')}
      onPointerDown={keepEditingFocus} onClick={onUndo}><Undo2 size={13} aria-hidden="true" /></button>
  ) : null;
  const timeInput = (field) => (
    <label className="schedule-clock-field">
      <input ref={field === 'start' ? startInputRef : undefined}
        data-schedule-field="time" data-schedule-time-endpoint={field}
        type="text" inputMode="numeric" maxLength={5} autoComplete="off" spellCheck={false}
        aria-label={t(field === 'start' ? 'editor.start_time' : 'editor.end_time')}
        aria-invalid={error ? true : undefined} aria-describedby={error ? errorId : hintId}
        value={draft[field]} onChange={(event) => change(field, event.target.value)}
        onFocus={(event) => { setFocusedField(field); event.target.select(); }}
        onBlur={() => {
          const minutes = parseScheduleEditorTime(draft[field], field === 'end');
          if (minutes !== null) change(field, minToTime(minutes));
        }}
        onKeyDown={(event) => handleTimeKeyDown(field, event)} style={{ fontFamily: typography.time }} />
    </label>
  );

  return (
    <section id="schedule-block-workbench" data-schedule-editor data-schedule-workbench
      data-workbench-state={selectedBlock ? 'selected' : 'idle'} data-workbench-variant={variant}
      aria-label={t('workbench.editor_label')} className="schedule-workbench"
      style={{
        '--schedule-editor-ink': visualTokens.inkPrimary, '--schedule-editor-muted': visualTokens.inkMuted,
        '--schedule-editor-focus': visualTokens.focusMarker, '--schedule-editor-danger': visualTokens.danger,
        '--schedule-editor-sheet': visualTokens.workbenchSelectedSurface, '--schedule-editor-seam': visualTokens.workbenchSeam,
        '--schedule-editor-shadow': visualTokens.shadowInk,
        '--schedule-mode-ink': selectedBlock?.intent === 'isolation' ? visualTokens.isolationInk : visualTokens.relaxationInk,
        color: visualTokens.inkPrimary, fontFamily: typography.body,
        ...(usesAttachedPaper && selectedBlock && placement ? {
          width: placement.width, marginLeft: placement.x, '--schedule-paper-join': `${placement.capLeft}px`,
        } : {}),
      }}>
      {selectedBlock ? (
        <div className="schedule-workbench-body" onBlur={handleBlur} onFocusCapture={() => setHasFocus(true)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.defaultPrevented || !optionsOpen) return;
            event.preventDefault(); event.stopPropagation();
            setOptionsOpen(false);
            optionsButtonRef.current?.focus();
          }}>
          <div className="schedule-editor-identity">
            <div className="schedule-mode-selector" role="radiogroup" aria-label={t('modes.label')}>
              {['relaxation', 'isolation'].map((intent) => (
                <button key={intent} type="button" role="radio" aria-checked={selectedBlock.intent === intent}
                  tabIndex={selectedBlock.intent === intent ? 0 : -1} data-schedule-mode={intent}
                  onFocus={() => setFocusedField(null)} onClick={() => setMode(intent)}
                  onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                    event.preventDefault();
                    const next = intent === 'isolation' ? 'relaxation' : 'isolation';
                    setMode(next);
                    event.currentTarget.parentElement.querySelector(`[data-schedule-mode="${next}"]`)?.focus();
                  }}>{t(intent === 'isolation' ? 'modes.isolation' : 'modes.relaxation')}</button>
              ))}
            </div>
            <input className="schedule-window-name" data-schedule-field="name" type="text" maxLength={40}
              aria-label={t('editor.name')} placeholder={t('editor.name_placeholder')} title={draft.name}
              value={draft.name} onChange={(event) => change('name', event.target.value)}
              onFocus={() => setFocusedField('name')} onKeyDown={handleKeyDown} autoComplete="off" spellCheck={false} />
            <div className="schedule-editor-actions">
              {undoControl}
              <button type="button" className="schedule-editor-delete" title={t('blocks.terminate')}
                aria-label={t('blocks.terminate')} onPointerDown={keepEditingFocus} onClick={remove}>
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
            <button ref={optionsButtonRef} type="button" className="schedule-editor-options"
              aria-label={t('editor.options')} aria-expanded={optionsOpen} aria-controls={optionsId}
              onFocus={() => setFocusedField(null)} onClick={() => setOptionsOpen((open) => !open)}>
              {t(optionsOpen ? 'editor.fold' : 'editor.details')}<ChevronDown size={11} aria-hidden="true" />
            </button>
          </div>
          <div className="schedule-clock-row">
            {timeInput('start')}<span aria-hidden="true" className="schedule-clock-dash">—</span>{timeInput('end')}
          </div>
          <div className="schedule-editor-inspector-content" id={optionsId} hidden={!optionsOpen}
            role="region" aria-label={t('editor.options')}>
            <div className="schedule-editor-setting-row">
              <div className="schedule-editor-alert-label">
                <span>{t('modes.notifications')}</span>
                <small>{t(alertRule === 'both' ? 'modes.alert_both' : alertRule === 'start' ? 'modes.alert_start' : 'modes.alert_end')}</small>
              </div>
              <button type="button" role="switch" aria-label={t('modes.notifications')} aria-checked={alertsOn}
                disabled={alertBusy} className="schedule-editor-alert-toggle" onClick={toggleAlert}>
                <span className="schedule-editor-switch" aria-hidden="true" />{t(alertsOn ? 'editor.on' : 'editor.off')}
              </button>
            </div>
            {alertError ? <p role="alert" className="schedule-editor-alert-error">{alertError}</p> : null}
            {selectedBlock.intent === 'isolation' ? (
              <div className="schedule-allowed-sites">
                <div className="schedule-allowed-heading"><span>{t('modes.passing_title')}</span><small>{t('modes.passing_common')}</small></div>
                <p>{t('modes.passing_rule')}</p>
                {allowedUrls.length ? <ul>{allowedUrls.map((host) => <li key={host}>{host}</li>)}</ul>
                  : <p>{t('special_session.allowlist_empty')}</p>}
                {onManageSites ? <button type="button" className="schedule-editor-secondary"
                  onClick={() => { if (commit()) onManageSites(); }}>{t('modes.manage_sites')}<span aria-hidden="true">↗</span></button> : null}
              </div>
            ) : null}
          </div>
          <div className="schedule-editor-feedback">
            {error ? <p id={errorId} role="alert">{errorMessages[error]}</p>
              : <p id={hintId} className="sr-only">{t('editor.keyboard_hint')}</p>}
          </div>
        </div>
      ) : (
        <div className="schedule-workbench-body schedule-workbench-idle" onBlur={handleBlur}>
          {!inlineEmptyAction ? <button type="button" data-schedule-add-window className="schedule-editor-secondary" onClick={add}>
            <span aria-hidden="true">＋</span>{t('workbench.add_window')}
          </button> : null}
          <p className="schedule-editor-idle-hint">{t('workbench.empty_description')}</p>{undoControl}
        </div>
      )}
    </section>
  );
}

export default React.memo(ScheduleBlockWorkbench);
