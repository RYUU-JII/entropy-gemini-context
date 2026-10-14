import { useCallback, useEffect, useRef } from 'react';

// Replace synchronously during render so an old async completion cannot enter
// the new lifetime in the interval before passive effect cleanup.
export function usePresentationSessionLifetime(key) {
  const ownerRef = useRef(null);
  if (ownerRef.current === null || ownerRef.current.key !== key) {
    ownerRef.current = Object.freeze({
      key,
      generation: ownerRef.current === null ? 1 : ownerRef.current.generation + 1,
    });
  }
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);
  const isCurrent = useCallback(lifetime => mountedRef.current && ownerRef.current === lifetime, []);
  return { lifetime: ownerRef.current, isCurrent };
}
