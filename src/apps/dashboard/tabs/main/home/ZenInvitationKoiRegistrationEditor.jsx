import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { beginSettingsFlowTiming, endSettingsFlowTiming } from '@/platform/diagnostics/settingsFlowTiming.js';
import './zenFirstSiteRegistration.css';

export default function ZenInvitationKoiRegistrationEditor({
  open = false, onClose, onSubmit, onConfirmMove, onOpenSites, initialCandidate = null,
  registrationAvailability, invitationEntityId = null, firstRegistration = false, appearance = 'water',
  firstUse = false, recordingIncludesOtherSites = false, onBrowseWithoutRecording = null, browseBusy = false, browseStatus = '',
}) {
  const { t } = useAppTranslation('main');
  const { t: sitesT } = useAppTranslation('sites');
  const editorRef = useRef(null), inputRef = useRef(null), submitRef = useRef(null), cancelRef = useRef(null);
  const browseRef = useRef(null);
  const returnFocusRef = useRef(null), busyRef = useRef(false), openSessionRef = useRef(false), draftsRef = useRef(new Map());
  const recoverPendingFocusRef = useRef(false);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(true), [moveReview, setMoveReview] = useState(null);
  const [firstUseSession, setFirstUseSession] = useState(firstUse);
  const [recordUsage, setRecordUsage] = useState(false);
  if (registrationAvailability === undefined) throw new Error('SITE_REGISTRATION_AVAILABILITY_REQUIRED');
  const canRegister = registrationAvailability?.available === true;
  // Membership can consume the final slot before the command owner finishes.
  // Keep that submitted form visible until its acknowledgement settles.
  const showsRegistration = canRegister || busy;

  useLayoutEffect(() => {
    if (!open) { openSessionRef.current = false; return; }
    if (openSessionRef.current) return;
    openSessionRef.current = true;
    returnFocusRef.current = document.activeElement;
    const draft = draftsRef.current.get(invitationEntityId);
    const nextDomain = initialCandidate?.domain ? initialCandidate.domain : draft ? draft.domain : '';
    const nextRecordUsage = draft && draft.firstUse === firstUse ? draft.recordUsage : false;
    setDomain(nextDomain);
    setFirstUseSession(firstUse);
    setRecordUsage(nextRecordUsage);
    draftsRef.current.set(invitationEntityId, { domain: nextDomain, firstUse, recordUsage: nextRecordUsage });
    setExpanded(firstUse || !initialCandidate?.domain);
    setBusy(false); setMessage(''); setMoveReview(null); busyRef.current = false;
    recoverPendingFocusRef.current = false;
  }, [open, initialCandidate, invitationEntityId, firstUse]);
  const updateDomain = (value) => {
    setDomain(value);
    draftsRef.current.set(invitationEntityId, { domain: value, firstUse: firstUseSession, recordUsage });
  };
  const updateRecording = (value) => {
    setRecordUsage(value);
    draftsRef.current.set(invitationEntityId, { domain, firstUse: firstUseSession, recordUsage: value });
  };
  useEffect(() => {
    if (!open) return;
    // Admit initial focus without trapping Tab or blocking the dashboard.
    (canRegister ? expanded && !moveReview ? inputRef : submitRef : cancelRef).current?.focus({ preventScroll: true });
  }, [open, canRegister, expanded, moveReview]);
  useEffect(() => {
    if (!open) { recoverPendingFocusRef.current = false; return; }
    if (busy || browseBusy) { recoverPendingFocusRef.current = browseBusy ? 'browse' : 'registration'; return; }
    if (!recoverPendingFocusRef.current) return;
    const continuation = recoverPendingFocusRef.current;
    recoverPendingFocusRef.current = false;
    // Chromium can blur a focused control when the pending command disables it.
    // Return only that lost continuation; a user-selected dashboard control keeps focus.
    if (document.activeElement !== document.body) return;
    if (continuation === 'browse') {
      if (browseStatus) browseRef.current?.focus({ preventScroll: true });
      return;
    }
    (canRegister ? expanded && !moveReview ? inputRef : submitRef : cancelRef).current?.focus({ preventScroll: true });
  }, [open, busy, browseBusy, browseStatus, canRegister, expanded, moveReview]);
  const restoreFocus = () => {
    const target = returnFocusRef.current;
    if (target?.isConnected && editorRef.current?.contains(document.activeElement)) target.focus({ preventScroll: true });
    const pondHost = editorRef.current?.parentElement;
    // The in-water entry is absent during editing. Restore to its new native
    // node after the close commit, without taking focus from another surface.
    requestAnimationFrame(() => {
      if (document.activeElement === document.body && pondHost?.isConnected) {
        pondHost.querySelector('[data-first-site-registration-entry]')?.focus({ preventScroll: true });
      }
    });
  };
  const close = () => {
    if (busyRef.current || browseBusy) return;
    draftsRef.current.set(invitationEntityId, { domain, firstUse: firstUseSession, recordUsage });
    restoreFocus(); onClose?.();
  };
  const cancelReview = () => { setMoveReview(null); setMessage(''); };
  const submit = async () => {
    if (!canRegister || busyRef.current || browseBusy) return;
    if (typeof onSubmit !== 'function') throw new Error('SITE_REGISTRATION_SUBMIT_OWNER_REQUIRED');
    busyRef.current = true; setBusy(true); setMessage('');
    const attempt = moveReview ? moveReview : { domain,
      ...(firstUseSession ? { firstUseRecording: recordUsage } : {}) };
    const options = { goalMinutes: null,
      ...(Object.hasOwn(attempt, 'firstUseRecording') ? { firstUseRecording: attempt.firstUseRecording } : {}) };
    try {
      if (moveReview && typeof onConfirmMove !== 'function') throw new Error('SITE_REGISTRATION_MOVE_OWNER_REQUIRED');
      const result = moveReview
        ? await onConfirmMove(moveReview.admission, options)
        : await onSubmit(attempt.domain, options);
      if (result?.ok) {
        const closeStarted = beginSettingsFlowTiming();
        draftsRef.current.delete(invitationEntityId); recoverPendingFocusRef.current = false; restoreFocus(); onClose?.();
        endSettingsFlowTiming('editor_close_requested', closeStarted);
        return;
      }
      if (result?.kind === 'confirm_move') {
        if (!result.admission) throw new Error('SITE_REGISTRATION_MOVE_ADMISSION_REQUIRED');
        setMoveReview({ admission: result.admission, domain: result.admission.normalizedDomain,
          ...options, messageKey: result.messageKey, messageParams: result.messageParams });
        return;
      }
      if (result?.kind === 'cancelled') return;
      setMessage(result?.messageKey ? sitesT(result.messageKey, result.messageParams || {})
        : result?.message || t('invitation_koi.error'));
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : t('invitation_koi.error'));
    } finally { busyRef.current = false; setBusy(false); }
  };
  if (!open) return null;
  const pending = busy || browseBusy;
  const browseAction = firstUseSession ? <button ref={browseRef} type="button" data-first-use-browse="true" disabled={pending}
    onClick={onBrowseWithoutRecording}>{t('first_use.browse')}</button> : null;
  return (
    <section ref={editorRef} className="zen-pond-registration font-ui" data-first-site-registration-editor="true"
      data-registration-appearance={appearance} data-first-registration={firstRegistration || undefined}
      data-main-first-use-registration={firstUseSession || undefined}
      aria-label={t(firstUseSession ? 'first_use.title' : showsRegistration ? 'invitation_koi.title' : 'invitation_koi.boundary_title')} aria-busy={pending}
      onKeyDown={event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        if (busyRef.current || browseBusy) return;
        if (moveReview) cancelReview(); else close();
      }}>
      {!showsRegistration ? (
        <div data-site-registration-boundary="true">
          <p role="status">{t(registrationAvailability === null ? 'invitation_koi.capacity_loading' : 'invitation_koi.boundary_body')}</p>
          {registrationAvailability?.mode === 'limited' ? <p className="zen-pond-registration-detail">{t(
            registrationAvailability.nextLimit === null ? 'invitation_koi.next_unlimited' : 'invitation_koi.next_capacity', {
              day: registrationAvailability.nextIncreaseDay, limit: registrationAvailability.nextLimit,
            })}</p> : null}
          <div className="zen-pond-registration-actions">
            <button ref={cancelRef} type="button" onClick={close} data-first-site-registration-cancel="true">{t('invitation_koi.cancel')}</button>
            <button type="button" onClick={() => onOpenSites?.()}>{t('invitation_koi.open_sites')}</button>
            {browseAction}
          </div>
        </div>
      ) : (
        <form onSubmit={event => { event.preventDefault(); if (event.currentTarget.reportValidity()) void submit(); }}>
          {moveReview ? (
            <div data-first-site-registration-review="true">
              <p className="zen-pond-registration-domain font-mono">{moveReview.domain}</p>
              <p className="zen-pond-registration-detail">{sitesT(moveReview.messageKey, moveReview.messageParams)}</p>
            </div>
          ) : !expanded ? (
            <div data-first-site-registration-candidate={domain}>
              <p className="zen-pond-registration-domain font-mono">{domain}</p>
            </div>
          ) : null}
          <div className="zen-pond-registration-fields" hidden={!expanded || moveReview !== null}>
            <label className="zen-pond-registration-label" htmlFor="zen-invitation-koi-domain">{t('invitation_koi.address_label')}</label>
            <input ref={inputRef} id="zen-invitation-koi-domain" className="zen-pond-registration-address font-mono"
              type="text" inputMode="url" autoComplete="url" spellCheck="false" disabled={pending || !expanded || moveReview !== null}
              required value={domain} onChange={event => updateDomain(event.target.value)} placeholder={t('invitation_koi.address_placeholder')} />
          </div>
          {firstUseSession ? <div className="zen-pond-registration-recording">
            <label>
              <input type="checkbox" data-first-use-recording="true" checked={recordUsage}
                disabled={pending || moveReview !== null} onChange={event => updateRecording(event.target.checked)} />
              <span>{t(recordingIncludesOtherSites ? 'first_use.record_protected' : 'first_use.record_site')}</span>
            </label>
            <p className="zen-pond-registration-detail">{t('first_use.record_hint')}</p>
          </div> : null}
          <div className="zen-pond-registration-actions">
            <button ref={submitRef} type="submit" disabled={pending} data-first-site-registration-submit="true"
              data-first-use-start={firstUseSession || undefined}>
              {pending ? t('invitation_koi.registering') : moveReview ? sitesT('admission.move_to_blocked') : t(firstUseSession ? 'first_use.start' : 'invitation_koi.register')}
              {!busy && <ArrowRight size={16} strokeWidth={1.3} aria-hidden="true" />}
            </button>
            {!expanded && !moveReview ? <button type="button" disabled={busy} data-first-site-registration-edit="true"
              onClick={() => setExpanded(true)}>{t('invitation_koi.edit')}</button> : null}
            <button type="button" disabled={pending} onClick={moveReview ? cancelReview : close} data-first-site-registration-cancel="true">
              {t(moveReview ? 'invitation_koi.back_to_edit' : 'invitation_koi.cancel')}
            </button>
            {browseAction}
          </div>
          {message ? <p role="alert" className="zen-pond-registration-error">{message}</p> : null}
          {browseStatus ? <p role="alert" className="zen-pond-registration-error">{browseStatus}</p> : null}
          {busy ? <span role="status" className="sr-only">{t('invitation_koi.registering')}</span> : null}
        </form>
      )}
    </section>
  );
}
