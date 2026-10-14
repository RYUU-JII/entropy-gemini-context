import { useCallback, useEffect, useState } from 'react';

// A tab may leave while a typed command settles. Retain only its presentation
// feedback so a mounted Sites frame can show that local owner's result.
export function useSitesPresentationFeedback(presentation) {
  presentation.feedback ||= { error: '', status: '', listeners: new Set() };
  const feedback = presentation.feedback;
  const [error, setErrorState] = useState(feedback.error);
  const [status, setStatusState] = useState(feedback.status);
  useEffect(() => {
    const update = () => { setErrorState(feedback.error); setStatusState(feedback.status); };
    feedback.listeners.add(update);
    update();
    return () => feedback.listeners.delete(update);
  }, [feedback]);
  const setError = useCallback((value) => {
    feedback.error = value;
    for (const update of feedback.listeners) update();
  }, [feedback]);
  const setStatus = useCallback((value) => {
    feedback.status = value;
    for (const update of feedback.listeners) update();
  }, [feedback]);
  return { error, status, setError, setStatus };
}
