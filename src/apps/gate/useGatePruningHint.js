import { useEffect, useState } from 'react';

// Selection changes start a new quiet interval; submission and unmount cancel it.
export function useGatePruningHint(selectionKey, ready, pending) {
  const [hintedSelection, setHintedSelection] = useState(null);
  useEffect(() => {
    setHintedSelection(null);
    if (!ready || pending) return undefined;
    const timer = window.setTimeout(() => setHintedSelection(selectionKey), 5000);
    return () => window.clearTimeout(timer);
  }, [selectionKey, ready, pending]);
  return ready && !pending && hintedSelection === selectionKey;
}
