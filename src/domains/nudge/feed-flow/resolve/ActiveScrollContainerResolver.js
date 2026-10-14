const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

export function isElement(node) {
  return typeof Element !== 'undefined' && node instanceof Element;
}

export function getRootScroller(documentRef) {
  return documentRef?.scrollingElement || documentRef?.documentElement || documentRef?.body || null;
}

export function isRootLikeScroller(node, documentRef) {
  const root = getRootScroller(documentRef);
  return node === root || node === documentRef?.documentElement || node === documentRef?.body;
}

export function normalizeScroller(node, documentRef) {
  if (!node) return getRootScroller(documentRef);
  if (node === documentRef) return getRootScroller(documentRef);
  if (node === documentRef?.defaultView) return getRootScroller(documentRef);
  if (isRootLikeScroller(node, documentRef)) return getRootScroller(documentRef);
  return isElement(node) ? node : getRootScroller(documentRef);
}

// A scroll event identifies the element that moved, including at either edge.
// Intent resolution (which ancestor could scroll next) cannot identify this fact.
export function resolveObservedScrollContainer(eventTarget, documentRef) {
  if (eventTarget === documentRef || eventTarget === documentRef?.defaultView
    || isRootLikeScroller(eventTarget, documentRef)) return getRootScroller(documentRef);
  return isElement(eventTarget) && eventTarget.isConnected ? eventTarget : null;
}

export function isScrollableElement(node, deltaY = 1, documentRef) {
  if (!isElement(node)) return false;

  const style = typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
  const overflowY = style?.overflowY || '';
  if (!isRootLikeScroller(node, documentRef) && !SCROLLABLE_OVERFLOW.has(overflowY)) {
    return false;
  }
  if (isRootLikeScroller(node, documentRef) && (overflowY === 'hidden' || overflowY === 'clip')) {
    return false;
  }

  if ((node.scrollHeight || 0) <= (node.clientHeight || 0)) return false;
  if (deltaY < 0 && (node.scrollTop || 0) <= 0) return false;
  if (deltaY > 0 && ((node.scrollTop || 0) + (node.clientHeight || 0)) >= ((node.scrollHeight || 0) - 1)) {
    return false;
  }
  return true;
}

export function findScrollableAncestor(startNode, deltaY = 1, documentRef) {
  let node = isElement(startNode) ? startNode : null;
  while (node && node !== documentRef?.body && node !== documentRef?.documentElement) {
    if (isScrollableElement(node, deltaY, documentRef)) return node;
    node = node.parentElement;
  }

  const root = getRootScroller(documentRef);
  if (isScrollableElement(root, deltaY, documentRef)) return root;
  return root;
}

export function readViewportHeight(windowRef, documentRef) {
  return Math.max(
    1,
    Number(windowRef?.innerHeight)
      || Number(documentRef?.documentElement?.clientHeight)
      || Number(documentRef?.body?.clientHeight)
      || 1,
  );
}

export function readViewportWidth(windowRef, documentRef) {
  return Math.max(
    1,
    Number(windowRef?.innerWidth)
      || Number(documentRef?.documentElement?.clientWidth)
      || Number(documentRef?.body?.clientWidth)
      || 1,
  );
}

export function readContainerHeight(scroller, windowRef, documentRef) {
  const normalizedScroller = normalizeScroller(scroller, documentRef);
  if (!normalizedScroller || normalizedScroller === windowRef || isRootLikeScroller(normalizedScroller, documentRef)) {
    return readViewportHeight(windowRef, documentRef);
  }
  return Math.max(1, Number(normalizedScroller.clientHeight) || readViewportHeight(windowRef, documentRef));
}

export function readScrollerPosition(scroller, windowRef, documentRef) {
  const normalizedScroller = normalizeScroller(scroller, documentRef);
  if (!normalizedScroller || normalizedScroller === windowRef || isRootLikeScroller(normalizedScroller, documentRef)) {
    return Math.max(
      0,
      Number(windowRef?.scrollY)
        || Number(windowRef?.pageYOffset)
        || Number(normalizedScroller?.scrollTop)
        || 0,
    );
  }
  return Math.max(0, Number(normalizedScroller.scrollTop) || 0);
}

export function resolveScrollContainer({
  sourceElement = null,
  eventTarget = null,
  deltaY = 1,
  documentRef = typeof document !== 'undefined' ? document : null,
} = {}) {
  const targetScroller = normalizeScroller(eventTarget, documentRef);
  if (targetScroller && isScrollableElement(targetScroller, deltaY, documentRef)) {
    return targetScroller;
  }
  return findScrollableAncestor(sourceElement || eventTarget, deltaY, documentRef);
}
