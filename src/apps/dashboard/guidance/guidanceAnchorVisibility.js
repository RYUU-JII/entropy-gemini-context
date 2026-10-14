export function isVisibleGuidanceAnchor(element) {
  if (!element?.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  const bounds = element.getBoundingClientRect();
  const elementStyle = getComputedStyle(element);
  if (bounds.width <= 0 || bounds.height <= 0 || elementStyle.visibility !== 'visible'
    || Number.parseFloat(elementStyle.opacity) === 0) return false;
  let left = Math.max(0, bounds.left), right = Math.min(window.innerWidth, bounds.right);
  let top = Math.max(0, bounds.top), bottom = Math.min(window.innerHeight, bounds.bottom);
  for (let owner = element.parentElement; owner; owner = owner.parentElement) {
    const style = getComputedStyle(owner), box = owner.getBoundingClientRect();
    if (Number.parseFloat(style.opacity) === 0) return false;
    if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)) {
      left = Math.max(left, box.left + owner.clientLeft);
      right = Math.min(right, box.left + owner.clientLeft + owner.clientWidth);
    }
    if (['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)) {
      top = Math.max(top, box.top + owner.clientTop);
      bottom = Math.min(bottom, box.top + owner.clientTop + owner.clientHeight);
    }
  }
  return left < right && top < bottom;
}

// IntersectionObserver supplies bounded re-entry events for anchors in any
// dashboard scroll owner. Geometry remains the admission/paint authority.
export function observeGuidanceAnchorVisibility(elements, onChange) {
  const visibility = new Map(elements.map(element => [element, isVisibleGuidanceAnchor(element)]));
  const update = entries => {
    let changed = false;
    for (const [element, next] of entries) {
      if (visibility.get(element) === next) continue;
      visibility.set(element, next);
      changed = true;
    }
    if (changed) onChange();
  };
  const observer = new IntersectionObserver(entries => {
    update(entries.map(entry => [entry.target, entry.isIntersecting && isVisibleGuidanceAnchor(entry.target)]));
  }, { threshold: 0 });
  const recheck = () => update([...visibility.keys()].map(element => [element, isVisibleGuidanceAnchor(element)]));
  // Enter transitions can change opacity without crossing an IO threshold.
  // Watch only each registered anchor's ancestry, and publish boolean changes.
  const owners = new Set();
  for (const element of visibility.keys()) {
    for (let owner = element; owner; owner = owner.parentElement) owners.add(owner);
  }
  const mutations = new MutationObserver(recheck);
  for (const owner of owners) mutations.observe(owner, {
    attributes: true, attributeFilter: ['style', 'class', 'hidden', 'inert', 'aria-hidden'],
  });
  const animationSettled = event => { if (owners.has(event.target)) recheck(); };
  document.addEventListener('animationend', animationSettled, true);
  document.addEventListener('transitionend', animationSettled, true);
  for (const element of visibility.keys()) observer.observe(element);
  return () => {
    observer.disconnect(); mutations.disconnect();
    document.removeEventListener('animationend', animationSettled, true);
    document.removeEventListener('transitionend', animationSettled, true);
  };
}
