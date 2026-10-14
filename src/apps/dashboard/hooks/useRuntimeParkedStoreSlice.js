import { useCallback, useLayoutEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';

/**
 * Retains the last active store projection while a mounted dashboard runtime is parked.
 * The retained value is presentation state only; reactivation always reads the current
 * canonical store state through the supplied selector.
 */
export function useRuntimeParkedStoreSlice(
  useStore,
  selectSlice,
  isRuntimeActive = true,
) {
  const retainedSliceRef = useRef(null);
  const hasRetainedSliceRef = useRef(false);
  const selectRuntimeSlice = useCallback((state) => {
    if (isRuntimeActive !== true && hasRetainedSliceRef.current) {
      return retainedSliceRef.current;
    }
    return selectSlice(state);
  }, [isRuntimeActive, selectSlice]);
  const selectedSlice = useStore(useShallow(selectRuntimeSlice));

  useLayoutEffect(() => {
    if (isRuntimeActive === true || !hasRetainedSliceRef.current) {
      retainedSliceRef.current = selectedSlice;
      hasRetainedSliceRef.current = true;
    }
  }, [isRuntimeActive, selectedSlice]);

  if (isRuntimeActive !== true && hasRetainedSliceRef.current) {
    return retainedSliceRef.current;
  }
  return selectedSlice;
}

export default useRuntimeParkedStoreSlice;
