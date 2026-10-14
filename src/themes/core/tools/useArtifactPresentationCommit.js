import { useCallback, useLayoutEffect, useState } from 'react';

// One owner for the complete visible frame, including its DOM placement.
// A prepared candidate can be rendered only for the current request. Submission
// runs after DOM mutations, before paint; interrupted/stale candidates never win.
export function useArtifactPresentationCommit(request, { retained }) {
  const [frames, setFrames] = useState(() => ({
    request, committed: { request }, candidate: null,
  }));
  // Rebase this owner's state during render so stale callbacks cannot replace a
  // newer candidate in the same batch. An effect/ref fence would run after child
  // layout effects, which is too late for the host's prepared-frame publication.
  if (frames.request !== request) {
    setFrames({ request, committed: frames.committed, candidate: null });
  }
  const candidate = retained && frames.candidate?.request === request
    ? frames.candidate : null;
  const onPrepared = useCallback((submit) => {
    if (typeof submit !== 'function') throw new Error('ARTIFACT_PREPARED_FRAME_SUBMIT_REQUIRED');
    setFrames(current => current.request === request
      ? { ...current, candidate: { request, submit } } : current);
  }, [request]);

  useLayoutEffect(() => {
    if (!candidate) return;
    const receipt = candidate.submit();
    if (receipt?.status !== 'committed' && receipt?.status !== 'superseded') {
      throw new Error('ARTIFACT_PRESENTATION_COMMIT_RECEIPT_INVALID');
    }
    setFrames(current => ({
      request: current.request,
      committed: receipt.status === 'committed' ? candidate : current.committed,
      candidate: current.candidate === candidate ? null : current.candidate,
    }));
  }, [candidate]);

  return {
    presentation: retained ? (candidate || frames.committed).request : request,
    onPrepared,
  };
}
