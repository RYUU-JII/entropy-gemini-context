import { useEffect, useRef, useState } from 'react';
import { SITES_GLOBAL_CAP_SAVE_SETTLE_MS } from './sitesGlobalCapModel.js';

export function useSitesCapEditor({ goalMinutes, onSave, normalizeGoal, saveErrorMessage, isRuntimeActive = true, presentationState }) {
  const [draftGoal, setDraftGoal] = useState(() => presentationState?.isEditing ? presentationState.draftGoal : String(goalMinutes));
  const [isEditing, setIsEditing] = useState(() => presentationState?.isEditing === true);
  const [isNumericEditing, setIsNumericEditing] = useState(() => presentationState?.isNumericEditing === true);
  const [savePhase, setSavePhase] = useState(() => presentationState?.pendingOperation ? 'saving' : presentationState?.savePhase || 'idle');
  const [saveError, setSaveError] = useState(() => presentationState?.saveError || '');
  const [pendingOperation, setPendingOperation] = useState(() => presentationState?.pendingOperation || null);
  const sliderRef = useRef(null);
  const actionsRef = useRef(null);
  const savingRef = useRef(Boolean(pendingOperation));
  const restoreFocusRef = useRef(false);
  const draftGoalMinutes = normalizeGoal(draftGoal);
  const isDraftValid = draftGoal !== '' && Number.isSafeInteger(draftGoalMinutes) && draftGoalMinutes >= 0;
  const isSaving = savePhase === 'saving';
  const isLocked = isSaving || savePhase === 'success';
  const hasChanged = draftGoal !== String(goalMinutes);

  useEffect(() => {
    if (!presentationState) return;
    Object.assign(presentationState, { draftGoal, isEditing, isNumericEditing, savePhase, saveError });
  }, [draftGoal, isEditing, isNumericEditing, presentationState, savePhase, saveError]);

  useEffect(() => {
    if (!pendingOperation) return undefined;
    let active = true;
    void pendingOperation.then((appliedMinutes) => {
      if (presentationState) Object.assign(presentationState, { draftGoal: String(appliedMinutes), isEditing: false, isNumericEditing: false, savePhase: 'success', saveError: '' });
      if (active) { setDraftGoal(String(appliedMinutes)); setIsEditing(false); setIsNumericEditing(false); setSavePhase('success'); }
    }).catch(() => {
      if (presentationState) Object.assign(presentationState, { savePhase: 'error', saveError: saveErrorMessage });
      if (active) { setSavePhase('error'); setSaveError(saveErrorMessage); }
    }).finally(() => {
      if (presentationState?.pendingOperation === pendingOperation) presentationState.pendingOperation = null;
      savingRef.current = false;
      if (active) setPendingOperation(null);
    });
    return () => { active = false; };
  }, [pendingOperation, presentationState, saveErrorMessage]);

  useEffect(() => {
    if (!isEditing && isRuntimeActive) setDraftGoal(String(goalMinutes));
  }, [goalMinutes, isEditing, isRuntimeActive]);

  useEffect(() => {
    if (savePhase !== 'success') return undefined;
    const finish = () => {
      setSavePhase('idle');
      setIsEditing(false);
      setIsNumericEditing(false);
    };
    if (!isRuntimeActive) { finish(); return undefined; }
    const timer = window.setTimeout(finish, SITES_GLOBAL_CAP_SAVE_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [savePhase, isRuntimeActive]);

  useEffect(() => {
    if (isEditing || hasChanged || !restoreFocusRef.current) return;
    if (isRuntimeActive && document.activeElement === document.body) sliderRef.current?.focus();
    restoreFocusRef.current = false;
  }, [hasChanged, isEditing, isRuntimeActive]);

  const updateDraftGoal = (value) => {
    if (isLocked || savingRef.current) return;
    const nextDraft = value === '' ? '' : String(normalizeGoal(value));
    setIsEditing(nextDraft !== String(goalMinutes) || isNumericEditing);
    setDraftGoal(nextDraft);
    setSaveError('');
    setSavePhase('idle');
  };

  const cancelEditing = () => {
    if (isLocked || savingRef.current) return;
    setDraftGoal(String(goalMinutes));
    setIsEditing(false);
    setIsNumericEditing(false);
    setSaveError('');
    setSavePhase('idle');
    sliderRef.current?.focus();
  };

  const finishEditing = async () => {
    if (isLocked || savingRef.current || !isDraftValid) return;
    if (!hasChanged) { cancelEditing(); return; }
    if (typeof onSave !== 'function') throw new Error('SITES_CAP_SAVE_HANDLER_REQUIRED');
    savingRef.current = true;
    restoreFocusRef.current = true;
    setSavePhase('saving');
    setSaveError('');
    let operation;
    try { operation = Promise.resolve(onSave(draftGoalMinutes)); }
    catch (error) { operation = Promise.reject(error); }
    operation = operation.then((appliedMinutes) => {
      if (!Number.isFinite(appliedMinutes) || appliedMinutes < 0) throw new Error('SITES_CAP_APPLIED_VALUE_REQUIRED');
      return appliedMinutes;
    });
    if (presentationState) presentationState.pendingOperation = operation;
    setPendingOperation(operation);
    // The mounted editor (including a later tab mount) owns local feedback.
    // The command bus continues to own persistence/application receipts.
    await operation.catch(() => undefined);
  };

  return {
    draftGoal, draftGoalMinutes, isDraftValid, isEditing, isNumericEditing,
    isSaving, isLocked, hasChanged, savePhase, saveError, sliderRef, actionsRef,
    updateDraftGoal, cancelEditing, finishEditing,
    beginNumericEditing: () => {
      if (isLocked) return;
      setIsEditing(true);
      setIsNumericEditing(true);
    },
    endNumericEditing: () => { setIsNumericEditing(false); setIsEditing(hasChanged); },
    handleGoalInputChange: (event) => {
      if (event.target.value === '' || /^\d+$/.test(event.target.value)) updateDraftGoal(event.target.value);
    },
    handleEditorKeyDown: (event) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelEditing(); }
    },
  };
}
