import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import './ArtifactControlGroupDisclosure.css';

const ArtifactControlGroupContext = createContext(null);

// Draft cancellation is local to mounted inputs. It never cancels a settings
// command or substitutes for the command owner's acknowledgement.
export function useArtifactControlGroupDraftCancellation(cancel) {
  const group = useContext(ArtifactControlGroupContext);
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useLayoutEffect(() => group?.registerDraftCancellation(() => cancelRef.current()), [group]);
}

export function useArtifactControlGroupFeedback(pending, error) {
  const group = useContext(ArtifactControlGroupContext);
  useEffect(() => {
    if (pending || error) group?.reveal();
  }, [group, pending, error]);
}

export default function ArtifactControlGroupDisclosure({ id, label, activeCount, revealKey = null, onCollapse, children }) {
  const { t } = useAppTranslation('tools');
  const detailsRef = useRef(null);
  const cancellations = useRef(new Set());
  const onCollapseRef = useRef(onCollapse);
  onCollapseRef.current = onCollapse;
  const registerDraftCancellation = useCallback(cancel => {
    cancellations.current.add(cancel);
    return () => cancellations.current.delete(cancel);
  }, []);
  const reveal = useCallback(() => { detailsRef.current.open = true; }, []);
  const discardDrafts = useCallback(() => {
    for (const cancel of cancellations.current) cancel();
  }, []);
  const group = useMemo(() => ({ registerDraftCancellation, reveal }), [registerDraftCancellation, reveal]);
  useLayoutEffect(() => {
    if (revealKey !== null) reveal();
  }, [revealKey, reveal]);
  return <details ref={detailsRef} data-artifact-control-group={id} className="artifact-control-group"
    onToggle={event => {
      if (event.currentTarget.open) return;
      discardDrafts();
      if (event.currentTarget.contains(document.activeElement)) event.currentTarget.querySelector('summary').focus();
      onCollapseRef.current?.();
    }}>
    <summary className="artifact-control-group__summary"
      onPointerDown={() => { if (detailsRef.current.open) discardDrafts(); }}
      onClick={() => { if (detailsRef.current.open) discardDrafts(); }}>
      <span>{label}</span>
      <span className="artifact-control-group__count">{t('artifact_controls.group_active_count', { count: activeCount })}</span>
    </summary>
    <ArtifactControlGroupContext.Provider value={group}>{children}</ArtifactControlGroupContext.Provider>
  </details>;
}
