import React, { useEffect, useId, useRef, useState } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import { useArtifactControlCommit } from '@/themes/core/tools/useArtifactControlCommit.js';
import { useArtifactControlGroupDraftCancellation, useArtifactControlGroupFeedback } from './ArtifactControlGroupDisclosure.jsx';
import { getVisualFrictionProfile } from '@/domains/settings/config/visualFrictionProfiles.js';
import './ArtifactRangeControl.css';

export function ArtifactRangeControl({ label, featureKey, enabled, value, onToggle, onValueChange, accentColor, offLabel, onLabel,
  disabled = false, showPreview = true, onFeedbackChange }) {
  const { t } = useAppTranslation('tools');
  const id = useId();
  const [draft, setDraft] = useState(null);
  const draftRef = useRef(null);
  const valueCommit = useArtifactControlCommit({ value, onCommit: onValueChange, disabled });
  const toggleCommit = useArtifactControlCommit({ value: enabled, onCommit: onToggle, disabled });
  const strength = draft === null ? valueCommit.activeValue : draft;
  const discardDraft = () => { draftRef.current = null; setDraft(null); };
  useArtifactControlGroupDraftCancellation(discardDraft);
  const commit = () => {
    const nextValue = draftRef.current;
    discardDraft();
    if (nextValue !== null) void valueCommit.commit(nextValue);
  };
  const profile = getVisualFrictionProfile(featureKey, 'normal', strength);
  const filterName = featureKey === 'saturation' ? 'grayscale' : featureKey === 'colorSaturation' ? 'saturate' : featureKey;
  const previewValue = featureKey === 'saturation' ? 1 - profile.value : profile.value;
  const previewFilter = toggleCommit.activeValue ? `${filterName}(${previewValue})` : 'none';
  const error = valueCommit.error || toggleCommit.error;
  const pending = valueCommit.pending || toggleCommit.pending;
  useArtifactControlGroupFeedback(pending, error);
  useEffect(() => { onFeedbackChange?.({ pending, error }); }, [onFeedbackChange, pending, error]);
  return (
    <div className="artifact-range-control" style={{ '--artifact-range-accent': accentColor }} aria-busy={pending}>
      <div className="artifact-range-control__line">
        <button type="button" role="switch" aria-checked={toggleCommit.activeValue} aria-label={label}
          className="artifact-range-control__toggle" disabled={disabled || typeof onToggle !== 'function'}
          onClick={() => toggleCommit.commit(!toggleCommit.activeValue)}>{toggleCommit.activeValue ? onLabel : offLabel}</button>
        <input id={id} type="range" min="0" max="100" step="1" value={strength} disabled={disabled}
          aria-label={t('artifact_range.value_label', { label })}
          aria-valuetext={t('artifact_range.value', { value: strength })}
          onChange={event => { const nextValue = Number(event.target.value); draftRef.current = nextValue; setDraft(nextValue); }}
          onPointerUp={commit} onPointerCancel={discardDraft} onBlur={commit}
          onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commit(); }} />
        <output htmlFor={id}>{t('artifact_range.value', { value: strength })}</output>
      </div>
      {showPreview ? <div className="artifact-range-control__preview" aria-hidden="true">
        <span className="artifact-range-control__swatch" />
        <span className="artifact-range-control__swatch" style={{ filter: previewFilter }} />
      </div> : null}
      <div className="artifact-range-control__ends"><span>{t('artifact_range.minimum')}</span><span>{t('artifact_range.maximum')}</span></div>
      {error ? <p role="alert" className="artifact-range-control__error">{t('artifact_range.save_failed')}</p> : null}
    </div>
  );
}
