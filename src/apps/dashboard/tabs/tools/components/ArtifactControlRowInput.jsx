import React, { useCallback, useEffect } from 'react';
import { useArtifactControlCommit } from '@/themes/core/tools/useArtifactControlCommit.js';
import ArtifactSegmentedControl from './ArtifactSegmentedControl.jsx';
import { ArtifactNumberControl } from './ArtifactNumberControl.jsx';
import { ArtifactRangeControl } from './ArtifactRangeControl.jsx';
import { useArtifactControlGroupFeedback } from './ArtifactControlGroupDisclosure.jsx';

const OFF = '__artifact_control_off__';
const ON = '__artifact_control_on__';

// Every row declares this app-owned input. Theme panels place it without
// importing dashboard code or replacing numeric command semantics.
export function ArtifactControlRowInput({ presentation = 'default', ...props }) {
  if (!['default', 'disclosed'].includes(presentation)) throw new Error('ARTIFACT_CONTROL_PRESENTATION_INVALID');
  if (props.controlMode === 'number' || props.controlMode === 'range') {
    const Control = props.controlMode === 'number' ? ArtifactNumberControl : ArtifactRangeControl;
    return <Control {...props}
      offLabel={presentation === 'disclosed' ? props.enableLabel : props.offLabel}
      onLabel={presentation === 'disclosed' ? props.disableLabel : props.onLabel}
      showPreview={presentation !== 'disclosed'} />;
  }
  if (presentation === 'disclosed') return <ArtifactDisclosedControl {...props} />;
  const binary = props.controlMode === 'binary';
  const offValue = props.controlMode === 'choice' ? OFF : 0;
  return <ArtifactSegmentedControl {...props}
    value={binary ? Number(props.enabled) : props.enabled ? props.value : offValue}
    includeOff={!binary} offValue={offValue}
    onSelect={next => binary ? props.onToggle(next > 0)
      : Object.is(next, offValue) ? props.onToggle(false) : props.onValueChange(next)} />;
}

function ArtifactDisclosedControl({
  label, controlMode, enabled, value, options = [], onToggle, onValueChange,
  disabled = false, enableLabel, disableLabel, feedback = '', feedbackContent = null,
  onFeedbackChange,
}) {
  const binary = controlMode === 'binary';
  const selected = enabled ? (binary ? ON : value) : OFF;
  const onCommit = useCallback(next => next === OFF ? onToggle(false)
    : next === ON ? onToggle(true) : onValueChange(next), [onToggle, onValueChange]);
  const { activeValue, pending, error, commit } = useArtifactControlCommit({ value: selected, onCommit, disabled });
  useArtifactControlGroupFeedback(pending, error);
  const activeEnabled = activeValue !== OFF;
  const detailValue = activeValue === OFF || activeValue === ON ? value : activeValue;
  const selectedOption = options.find(option => Object.is(option.value, detailValue));
  const detailFeedback = selectedOption?.feedback || feedback;
  useEffect(() => { onFeedbackChange?.({ pending, error }); }, [onFeedbackChange, pending, error]);
  return <div className="artifact-disclosed-control" aria-busy={pending}>
    <button type="button" className="artifact-disclosed-control__action"
      aria-label={`${label} ${activeEnabled ? disableLabel : enableLabel}`}
      data-artifact-control-value={activeEnabled ? '__off__' : '__on__'}
      disabled={disabled} onClick={() => commit(activeEnabled ? OFF : ON)}>
      {activeEnabled ? disableLabel : enableLabel}
    </button>
    {!binary ? <div role="radiogroup" aria-label={label} className="artifact-disclosed-control__choices">
      {options.map((option, index) => <button key={String(option.value)} type="button" role="radio"
        aria-checked={activeEnabled && Object.is(detailValue, option.value)}
        aria-label={`${label} ${option.label}`} title={option.feedback || undefined}
        data-artifact-control-value={String(option.value)} disabled={disabled}
        tabIndex={Object.is(detailValue, option.value) || (!selectedOption && index === 0) ? 0 : -1}
        onClick={() => commit(option.value)} onKeyDown={event => {
          const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1
            : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
          if (!direction && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : (index + direction + options.length) % options.length;
          event.currentTarget.parentElement.querySelectorAll('[role="radio"]')[nextIndex].focus();
          commit(options[nextIndex].value);
        }} className="artifact-disclosed-control__choice">{option.shortLabel || option.label}</button>)}
    </div> : null}
    {feedbackContent ? <div className="artifact-disclosed-control__feedback" aria-live="polite">{feedbackContent}</div>
      : detailFeedback ? <p className="artifact-disclosed-control__feedback">{detailFeedback}</p> : null}
    {error ? <p role="alert" className="artifact-disclosed-control__error">{error}</p> : null}
  </div>;
}
