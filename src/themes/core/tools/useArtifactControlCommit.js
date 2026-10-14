import { useCallback, useRef, useState } from 'react';

function describeCommitFailure(error) {
  const text = error instanceof Error ? error.message : String(error || 'ARTIFACT_SETTING_COMMIT_FAILED');
  return text.replace(/\bhttps?:\/\/[^\s)]+/gi, '[redacted-url]');
}

// Presentation owns only pending intent and failure feedback. Settled values
// always come back from the canonical settings prop, in every theme.
export function useArtifactControlCommit({ value, onCommit, disabled = false }) {
  const [pendingCommit, setPendingCommit] = useState(null);
  const [error, setError] = useState('');
  const sequenceRef = useRef(0);
  const canCommit = !disabled && typeof onCommit === 'function';
  const commit = useCallback((nextValue) => {
    if (!canCommit || (Object.is(nextValue, value) && pendingCommit === null && !error)) return undefined;
    const sequence = ++sequenceRef.current;
    setError('');
    setPendingCommit({ sequence, value: nextValue });
    const settle = () => {
      if (sequenceRef.current === sequence) setPendingCommit(null);
    };
    const fail = (failure) => {
      const detail = describeCommitFailure(failure);
      if (sequenceRef.current === sequence) setError(detail);
      settle();
      return { ok: false, error: detail };
    };
    const acknowledge = (result) => {
      if (result?.error || result?.ok === false) {
        return fail(result.error || result.reason || 'ARTIFACT_SETTING_COMMIT_FAILED');
      }
      settle();
      return result;
    };
    try {
      const result = onCommit(nextValue);
      return result && typeof result.then === 'function'
        ? Promise.resolve(result).then(acknowledge, fail)
        : acknowledge(result);
    } catch (failure) {
      return fail(failure);
    }
  }, [canCommit, pendingCommit, value, error, onCommit]);
  return { activeValue: pendingCommit?.value ?? value, pending: pendingCommit !== null, error, commit };
}
