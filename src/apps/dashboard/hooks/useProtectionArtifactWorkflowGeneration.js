import { useCallback, useLayoutEffect, useRef } from 'react';

export function useProtectionArtifactWorkflowGeneration(isActive = true) {
  const generationRef = useRef({
    active: isActive === true,
    revision: 0,
  });

  useLayoutEffect(() => {
    generationRef.current = {
      active: isActive === true,
      revision: generationRef.current.revision + 1,
    };
    return () => {
      generationRef.current = {
        active: false,
        revision: generationRef.current.revision + 1,
      };
    };
  }, [isActive]);

  const captureWorkflowGeneration = useCallback(
    () => generationRef.current.revision,
    [],
  );
  const isWorkflowGenerationCurrent = useCallback((revision) => (
    generationRef.current.active === true
    && generationRef.current.revision === revision
  ), []);

  return {
    captureWorkflowGeneration,
    isWorkflowGenerationCurrent,
  };
}

export default useProtectionArtifactWorkflowGeneration;
