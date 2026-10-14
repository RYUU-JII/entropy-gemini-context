import React, { useEffect, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactControlCommit } from '@/themes/core/tools/useArtifactControlCommit.js';
import { useArtifactControlGroupDraftCancellation, useArtifactControlGroupFeedback } from './ArtifactControlGroupDisclosure.jsx';
import './ArtifactNumberControl.css';

export function ArtifactNumberControl({
  label, enabled, value, min, max, onToggle, onValueChange,
  disabled = false, offLabel, onLabel, feedback = '',
  onFeedbackChange,
}) {
  const { t } = useAppTranslation('tools');
  const [draft, setDraft] = useState(String(value));
  const draftRef = useRef(String(value));
  const updateDraft = next => { draftRef.current = next; setDraft(next); };
  const [validationError, setValidationError] = useState('');
  const numberCommit = useArtifactControlCommit({ value, onCommit: onValueChange, disabled });
  const toggleCommit = useArtifactControlCommit({ value: enabled, onCommit: onToggle, disabled });
  const pending = numberCommit.pending || toggleCommit.pending;
  useArtifactControlGroupDraftCancellation(() => { updateDraft(String(value)); setValidationError(''); });
  useEffect(() => { draftRef.current = String(value); setDraft(String(value)); }, [value]);
  const commitNumber = (raw) => {
    const next = Number(raw);
    if (String(raw).trim() === '' || !Number.isInteger(next) || next < min || next > max) {
      setValidationError(t('artifact_number.invalid', { min, max }));
      return;
    }
    setValidationError('');
    updateDraft(String(next));
    return numberCommit.commit(next);
  };
  const step = (amount) => {
    const currentDraft = draftRef.current;
    const current = currentDraft.trim() !== '' && Number.isInteger(Number(currentDraft)) ? Number(currentDraft) : value;
    return commitNumber(Math.max(min, Math.min(max, current + amount)));
  };
  const error = validationError || numberCommit.error || toggleCommit.error;
  useArtifactControlGroupFeedback(pending, error);
  useEffect(() => { onFeedbackChange?.({ pending, error }); }, [onFeedbackChange, pending, error]);
  return (
    <div className="artifact-number-control" aria-busy={pending}>
      <div className="artifact-number-control__line">
        <button type="button" role="switch" aria-checked={toggleCommit.activeValue}
          aria-label={label} disabled={disabled || pending}
          className="artifact-number-control__toggle"
          onClick={() => toggleCommit.commit(!enabled)}>
          {toggleCommit.activeValue ? onLabel : offLabel}
        </button>
        <div className="artifact-number-control__stepper">
          <input type="number" inputMode="numeric" min={min} max={max} step="1"
            aria-label={t('artifact_number.value_label', { label })}
            aria-invalid={Boolean(validationError)} value={draft} disabled={disabled || pending}
            onChange={(event) => { updateDraft(event.target.value); setValidationError(''); }}
            onBlur={() => { if (draftRef.current !== String(value)) commitNumber(draftRef.current); }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') { event.preventDefault(); commitNumber(draftRef.current); }
              // The enclosing disclosure may focus its summary in this same
              // event. Clear the existing draft before that native blur fires.
              if (event.key === 'Escape') { event.preventDefault(); updateDraft(String(value)); setValidationError(''); }
              if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                event.preventDefault(); step(event.key === 'ArrowUp' ? 1 : -1);
              }
            }} />
          <div className="artifact-number-control__steps">
            <button type="button" aria-label={t('artifact_number.increase', { label })}
              disabled={disabled || pending || Number(draft) >= max}
              onMouseDown={(event) => event.preventDefault()} onClick={() => step(1)}>▴</button>
            <button type="button" aria-label={t('artifact_number.decrease', { label })}
              disabled={disabled || pending || Number(draft) <= min}
              onMouseDown={(event) => event.preventDefault()} onClick={() => step(-1)}>▾</button>
          </div>
        </div>
      </div>
      {feedback ? <p className="artifact-number-control__feedback">{feedback}</p> : null}
      {error ? <p role="alert" className="artifact-number-control__error">{error}</p> : null}
    </div>
  );
}
