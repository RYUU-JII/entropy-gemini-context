export const PREPAINT_VISUAL_SUPPRESSION_ATTR = 'data-entropy-prepaint-suppressed';

export function suppressPrepaintVisualEffects(root = null) {
  const resolvedRoot = root || (typeof document !== 'undefined' ? document.documentElement : null);
  if (!resolvedRoot?.setAttribute) return;
  resolvedRoot.setAttribute(PREPAINT_VISUAL_SUPPRESSION_ATTR, '1');
}
