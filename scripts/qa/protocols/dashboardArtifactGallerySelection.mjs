// Serialized into dashboard/capture's owned document. Selects an artifact
// through the gallery's actual controls, whichever index the theme declares:
//
// - quickbar (`direct`): click the family's own button.
// - path (`sequential`, Zen): there is no position index; walk the
//   path one neighbour at a time with the edge thresholds, taking the shorter
//   way round, and let every intermediate step settle before the next one.
//
// `isReady(family)` is the caller's presentation oracle; `codePrefix` keeps the
// caller's established failure codes.
export function artifactGallerySelection(codePrefix, isReady) {
  const pathIndex = () => document.querySelector('[data-artifact-gallery-index="path"]');
  const wait = async (predicate, label) => {
    const started = performance.now();
    while (!predicate()) {
      if (performance.now() - started > 20000) throw new Error(`${codePrefix}_TIMEOUT:${label}`);
      await new Promise(resolve => setTimeout(resolve, 16));
    }
  };
  const selectedFamily = () => {
    const path = pathIndex();
    if (path) return path.dataset.artifactPathCurrent;
    const node = document.querySelector('button[data-artifact-gallery-family-id][aria-current="true"]');
    return node?.dataset.artifactGalleryFamilyId || null;
  };
  const pathOrder = () => {
    const path = pathIndex();
    const order = path?.dataset.artifactPathOrder;
    const locked = path?.dataset.artifactPathLocked;
    if (!order || typeof locked !== 'string') throw new Error(`${codePrefix}_PATH_INVENTORY_REQUIRED`);
    return order.split('|').filter(family => !locked.split('|').includes(family));
  };
  const neighbour = (step) => {
    const order = pathOrder();
    const index = order.indexOf(selectedFamily());
    if (index < 0) throw new Error(`${codePrefix}_SELECTED_FAMILY_REQUIRED`);
    return order[(index + step + order.length) % order.length];
  };
  // Click one edge threshold without waiting for the result.
  const press = (step) => {
    const button = pathIndex()?.querySelector(`button[data-artifact-path-threshold="${step > 0 ? 'next' : 'previous'}"]`);
    if (!button || button.getAttribute('aria-disabled') === 'true') {
      throw new Error(`${codePrefix}_CONTROL_UNAVAILABLE:${step > 0 ? 'next' : 'previous'}`);
    }
    button.click();
  };
  const settle = (family) => wait(() => {
    if (pathIndex()?.querySelector('[role="alert"]')) throw new Error(`${codePrefix}_SELECTION_FAILED:${family}`);
    return selectedFamily() === family && isReady(family);
  }, `select:${family}`);
  // One settled step along the path; returns the family stepped onto.
  const step = async (direction) => {
    const expected = neighbour(direction);
    press(direction);
    await settle(expected);
    return expected;
  };
  const select = async (family) => {
    if (!pathIndex()) {
      const button = document.querySelector(`button[data-artifact-gallery-family-id="${family}"]`);
      if (!button || button.getAttribute('aria-disabled') === 'true') throw new Error(`${codePrefix}_CONTROL_UNAVAILABLE:${family}`);
      button.click();
      await wait(() => {
        if (button.dataset.artifactGalleryLoadState === 'error') throw new Error(`${codePrefix}_SELECTION_FAILED:${family}`);
        return button.getAttribute('aria-current') === 'true' && button.getAttribute('aria-busy') !== 'true' && isReady(family);
      }, `select:${family}`);
      return [family];
    }
    const visited = [];
    while (selectedFamily() !== family) {
      const order = pathOrder();
      const from = order.indexOf(selectedFamily());
      const to = order.indexOf(family);
      if (from < 0 || to < 0) throw new Error(`${codePrefix}_CONTROL_UNAVAILABLE:${family}`);
      const forward = (to - from + order.length) % order.length;
      visited.push(await step(forward <= order.length - forward ? 1 : -1));
    }
    if (!isReady(family)) await settle(family);
    return visited;
  };
  return { isPath: () => Boolean(pathIndex()), selectedFamily, pathOrder, neighbour, press, settle, step, select };
}
