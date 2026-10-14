import { useLayoutEffect, useMemo, useRef } from 'react';
const useZenViewStateController = ({
  t,
  tuning = null,
  panelLabel = '',
  dailyScore = null,
  status = 'safe',
  rendererWidth = 0,
  rendererHeight = 0,
  isTabActive = true,
  shouldAnimateScanner = false,
  documentVisible = true,
  runtimeMountReady = true,
  runtimeAnimateReady = true
} = {}) => {
  const animationEnabledRef = useRef(true);
  const hasViewport = Number(rendererWidth) > 0 && Number(rendererHeight) > 0;
  // Hidden retained tabs must release the shared pond lease. In particular a
  // global reset must not let the hidden Home surface reclaim the Lab canvas.
  // Document visibility only pauses animation; it does not change the lease.
  const canMountRenderer = runtimeMountReady === true && hasViewport && isTabActive !== false;
  const docHidden = typeof document !== 'undefined' ? document.hidden === true : false;
  const animationEnabled = runtimeAnimateReady === true && !docHidden && documentVisible !== false && isTabActive !== false && shouldAnimateScanner !== false;
  const swimModelBadge = useMemo(() => {
    if (panelLabel) return panelLabel;
    const model = tuning?.physics?.swimModel;
    return t(`tools:koi_tuner.model_options.${model || 'cpg_dynamics'}`, {});
  }, [panelLabel, t, tuning?.physics?.swimModel]);
  const waterClarity = useMemo(() => {
    const causeClarity = Number(tuning?.envWaterClarity);
    const resolvedClarity = Number.isFinite(causeClarity) ? causeClarity : 0.64;
    if (resolvedClarity >= 0.60) return 'clear';
    if (resolvedClarity <= 0.36) return 'deep';
    return 'algae';
  }, [tuning?.envWaterClarity]);
  // The following renderer layout effects acquire/resume the retained canvas
  // in this same commit and must observe the current visibility decision.
  useLayoutEffect(() => {
    animationEnabledRef.current = animationEnabled;
  }, [animationEnabled]);
  return {
    animationEnabledRef,
    animationEnabled,
    rendererBootReady: true,
    canMountRenderer,
    swimModelBadge,
    waterClarity
  };
};
export { useZenViewStateController };
