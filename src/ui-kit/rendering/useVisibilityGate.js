import { useDocumentVisibility } from '@/ui-kit/hooks/useDocumentVisibility.js';
import { useElementVisibility } from '@/ui-kit/hooks/useElementVisibility.js';

export function useVisibilityGate(
  targetRef,
  {
    active = true,
    threshold = 0.08,
    rootMargin = '140px',
    root = null,
  } = {},
) {
  const documentVisible = useDocumentVisibility();
  const inViewport = useElementVisibility(targetRef, {
    active,
    threshold,
    rootMargin,
    root,
  });
  const shouldAnimate = Boolean(active) && documentVisible && inViewport;
  return {
    shouldAnimate,
    documentVisible,
    inViewport,
  };
}
