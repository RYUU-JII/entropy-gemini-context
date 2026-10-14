import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';
import { requireSitesCapAdmissionStatus } from './sitesCapAdmission.js';
import './sitesHud.css';

export default function SitesCapControl({ editor, title, scope, committedLabel, goalMinutes,
  enabled = true, policyLabel = '', limitLabel, maxMinutes, zeroLabel, formatDuration, t,
  evidence = null, hint = '', recommendation = null, onDismissRecommendation, unavailableMessage = '', admissionStatus,
  isRuntimeActive = true, variant = 'standard', minimal = false, showAdmissionFeedback = true,
  presentation = 'inline', isPresented = true, onRequestClose, navigationRef = null, ...attributes }) {
  if (!['inline', 'anchored', 'workspace'].includes(presentation)) throw new Error('SITES_CAP_PRESENTATION_INVALID');
  const isWorkspace = presentation === 'workspace';
  if (isWorkspace && typeof onRequestClose !== 'function') throw new Error('SITES_CAP_WORKSPACE_CLOSE_HANDLER_REQUIRED');
  requireSitesCapAdmissionStatus(admissionStatus);
  const admissionReady = admissionStatus === 'ready';
  const mutationBlocked = !admissionReady || Boolean(unavailableMessage);
  const inputReadOnly = admissionStatus === 'loading';
  const inputDisabled = editor.isLocked || admissionStatus === 'error' || Boolean(unavailableMessage);
  const admissionMessage = admissionReady || !showAdmissionFeedback ? '' : admissionStatus === 'loading'
    ? t('common:status.loading') : t('site_workspace.snapshot_unavailable_body');
  const [open, setOpen] = useState(() => editor.isNumericEditing === true);
  const presentedOpen = isWorkspace ? isPresented : open;
  const focusActive = isRuntimeActive && isPresented;
  const readout = useRef(null);
  const trigger = useRef(null);
  const input = useRef(null);
  const form = useRef(null);
  const initialFocus = useRef({ open: false, pending: false });
  const restoreFocus = useRef(false);
  const navigationFocusOwner = useRef(null);
  const workspaceStarted = useRef(false);
  const successHandled = useRef(false);
  const backHandler = useRef(null);
  const navigationDomain = attributes['data-domain'];
  const id = useId();
  const cancel = () => {
    if (editor.isLocked) return;
    editor.cancelEditing();
    if (isWorkspace) {
      onRequestClose('cancel');
      return;
    }
    restoreFocus.current = true;
    setOpen(false);
  };
  backHandler.current = () => {
    if (editor.isLocked) return true;
    if (!presentedOpen) return false;
    if (!isWorkspace) navigationFocusOwner.current = document.activeElement;
    cancel();
    return true;
  };
  useLayoutEffect(() => {
    if (navigationRef === null || !focusActive) return undefined;
    // The app owns the Back chain. A retained, hidden overview still owns its
    // numeric draft and accepted save, so visibility does not cancel this seam.
    const navigation = { domain: navigationDomain, back: () => backHandler.current() };
    navigationRef.current = navigation;
    return () => { if (navigationRef.current === navigation) navigationRef.current = null; };
  }, [navigationRef, focusActive, navigationDomain]);
  useLayoutEffect(() => {
    if (!open && restoreFocus.current && !editor.isLocked) {
      restoreFocus.current = false;
      const ownsFocus = document.activeElement === document.body
        || document.activeElement === navigationFocusOwner.current;
      navigationFocusOwner.current = null;
      if (focusActive && ownsFocus && !trigger.current?.disabled
        && !trigger.current?.closest('[hidden], [inert]')) {
        trigger.current?.focus({ preventScroll: true });
      }
    }
  }, [open, focusActive, editor.isLocked]);
  useEffect(() => {
    if (!isWorkspace || !isPresented) {
      workspaceStarted.current = false;
      return;
    }
    if (!isRuntimeActive || workspaceStarted.current) return;
    workspaceStarted.current = true;
    editor.beginNumericEditing();
  }, [isWorkspace, isPresented, isRuntimeActive, editor.beginNumericEditing]);
  useEffect(() => {
    const newlyOpened = presentedOpen && !initialFocus.current.open;
    initialFocus.current.open = presentedOpen;
    if (!presentedOpen) {
      initialFocus.current.pending = false;
      return;
    }
    if (newlyOpened) initialFocus.current.pending = true;
    if (!initialFocus.current.pending || !focusActive) return;
    if (inputDisabled) {
      if (isWorkspace && !editor.isLocked) {
        initialFocus.current.pending = false;
        if (newlyOpened || document.activeElement === document.body || form.current?.contains(document.activeElement)) {
          form.current?.querySelector('button[type="button"]')?.focus({ preventScroll: true });
        }
      }
      return;
    }
    // Admission can recover after this field opens disabled. Complete that
    // initial request once, without pulling focus back from another control.
    initialFocus.current.pending = false;
    if (newlyOpened || document.activeElement === document.body || form.current?.contains(document.activeElement)) {
      input.current?.focus({ preventScroll: true });
    }
  }, [presentedOpen, focusActive, inputDisabled, isWorkspace, editor.isLocked]);
  // Presentation state retains the open field and draft across tab changes;
  // visibility never commits a value or keeps the runtime subscribed.
  useEffect(() => {
    if (isWorkspace) {
      if (editor.savePhase !== 'success') {
        successHandled.current = false;
      } else if (!successHandled.current) {
        successHandled.current = true;
        onRequestClose('applied');
      }
      return;
    }
    if (editor.savePhase !== 'success' || !open) return;
    restoreFocus.current = focusActive;
    setOpen(false);
  }, [editor.savePhase, focusActive, isWorkspace, onRequestClose, open]);
  const feedback = editor.saveError || admissionMessage || unavailableMessage
    || (editor.isSaving ? t('sites_hud.saving') : editor.hasChanged ? t('sites_hud.preview') : '');
  // The retained editor keeps its original trigger and draft owner. On a
  // bounded canvas, place the complete form inside the available sheet rather
  // than assuming that there is another document viewport below the trigger.
  useLayoutEffect(() => {
    if (presentation !== 'anchored' || !presentedOpen || !focusActive) return undefined;
    const anchor = readout.current;
    const popup = form.current;
    const canvas = anchor.closest('[data-sites-canvas="bounded"]');
    if (!canvas) return undefined;
    const ink = anchor.closest('.zen-site-ledger__today');
    if (!ink) throw new Error('SITES_CAP_ANCHOR_INK_REQUIRED');
    const place = () => {
      const sheetBounds = canvas.getBoundingClientRect();
      const inkBounds = ink.getBoundingClientRect();
      const anchorBounds = anchor.getBoundingClientRect();
      if (sheetBounds.height === 0 || inkBounds.width === 0) return;
      const width = Math.min(320, inkBounds.width);
      popup.style.width = `${width}px`;
      const left = Math.max(inkBounds.left, Math.min(anchorBounds.left, inkBounds.right - width));
      const height = popup.getBoundingClientRect().height;
      const top = Math.max(sheetBounds.top + 8,
        Math.min(anchorBounds.bottom + 4, sheetBounds.bottom - height - 8));
      popup.style.insetInlineStart = `${left - anchorBounds.left}px`;
      popup.style.insetBlockStart = `${top - anchorBounds.top}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    [canvas, ink, anchor, popup].forEach(node => observer.observe(node));
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      popup.style.removeProperty('width');
      popup.style.removeProperty('inset-inline-start');
      popup.style.removeProperty('inset-block-start');
    };
  }, [presentation, presentedOpen, focusActive]);
  return <div ref={readout} className="sites-cap-readout font-sans" data-variant={variant} data-editing={isWorkspace || open}
    data-save-phase={editor.savePhase} data-cap-admission={admissionStatus} data-presentation={minimal ? 'note' : 'standard'} data-cap-presentation={presentation} {...attributes}>
    {!isWorkspace && <span className="sites-cap-readout__scope">{scope}</span>}
    {!isWorkspace && (enabled && (!open || presentation === 'anchored') ? <button ref={trigger} type="button" className="sites-cap-readout__value"
      aria-label={title + ' · ' + committedLabel} aria-expanded={open} aria-controls={id}
      disabled={editor.isLocked || open} onClick={() => { editor.beginNumericEditing(); setOpen(true); }}>
      <span>{committedLabel}</span>{unavailableMessage && <small>{t('recording.cap_inactive')}</small>}
      <i data-pending={editor.hasChanged} aria-hidden="true" />
    </button> : !enabled ? <span className="sites-cap-readout__policy">{policyLabel}</span> : null)}
    {(isWorkspace || open) && <form ref={form} id={id} hidden={isWorkspace && !isPresented} className="sites-cap-inline-editor" aria-label={title} aria-busy={editor.isSaving}
      onKeyDown={event => { if (event.key === 'Escape' && !event.repeat && !event.nativeEvent.isComposing) { event.preventDefault(); cancel(); } }}
      onSubmit={event => { event.preventDefault(); if (!mutationBlocked) void editor.finishEditing(); }}>
      <label className="sr-only" htmlFor={id + '-minutes'}>{limitLabel}</label>
      <div className="sites-cap-inline-editor__controls">
        <input ref={input} id={id + '-minutes'} required type="number" inputMode="numeric" min={0} max={maxMinutes} step={1}
          value={editor.draftGoal} disabled={inputDisabled} readOnly={inputReadOnly} aria-describedby={id + '-feedback'}
          onFocus={event => event.target.select()} onChange={event => { if (!mutationBlocked) editor.handleGoalInputChange(event); }} />
        <span>{t('standard_panel.minute_suffix')}</span>
        <button type="submit" disabled={editor.isLocked || mutationBlocked || !editor.isDraftValid || !editor.hasChanged}>
          {editor.isSaving ? <LoaderCircle size={14} className="sites-cap__spinner" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
          {t(editor.isSaving ? 'sites_hud.saving' : editor.savePhase === 'error' ? 'sites_hud.retry' : 'sites_hud.done')}
        </button>
        <button type="button" disabled={editor.isLocked} onClick={cancel}>{t('common:action.cancel')}</button>
      </div>
      <div id={id + '-feedback'} className="sites-cap-inline-editor__feedback" role={editor.saveError ? 'alert' : 'status'}>
        <span>{feedback}</span>{admissionReady && hint && !editor.saveError && <span>{hint}</span>}
        {editor.isDraftValid && <span>{goalMinutes === 0 ? zeroLabel : formatDuration(goalMinutes * 60000)}</span>}
      </div>
      {admissionReady && evidence}
    </form>}
    {!isWorkspace && recommendation && !open && <div className="sites-cap-recommendation"><span>{t('sites_cap.recommendation', { minutes: recommendation.recommendedTargetMinutes })}</span>
      <button type="button" disabled={mutationBlocked || editor.isLocked} onClick={() => { editor.beginNumericEditing(); editor.updateDraftGoal(recommendation.recommendedTargetMinutes); setOpen(true); }}>{t('sites_cap.review_recommendation')}</button>
      <button type="button" onClick={onDismissRecommendation}>{t('common:action.cancel')}</button></div>}
    {!isWorkspace && !open && (admissionMessage || unavailableMessage) && <span className="sites-cap-readout__availability" role={admissionStatus === 'error' ? 'alert' : 'status'}>{admissionMessage || unavailableMessage}</span>}
  </div>;
}
