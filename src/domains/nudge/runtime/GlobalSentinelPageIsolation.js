// The surface arbiter owns gameplay input. This lease owns native page
// hit-testing and scrolling only after the first accepted Global input.
export function createGlobalSentinelPageIsolation({ documentRef = document, root }) {
  const body = documentRef.body;
  if (!body || root?.ownerDocument !== documentRef || !root.isConnected
    || root.parentNode !== documentRef.documentElement || body.contains(root)) {
    throw new Error('global_sentinel_page_isolation_root_required');
  }
  const previousInert = body.inert;
  const styles = [documentRef.documentElement, body].flatMap(element => (
    [['overflow', 'hidden'], ['overscroll-behavior', 'none']].map(([name, applied]) => ({
      element, name, applied, value: element.style.getPropertyValue(name),
      priority: element.style.getPropertyPriority(name),
    }))
  ));
  styles.push({ element: root, name: 'pointer-events', applied: 'auto',
    value: root.style.getPropertyValue('pointer-events'), priority: root.style.getPropertyPriority('pointer-events') });
  const attributes = [['role', 'dialog'], ['aria-modal', 'true']]
    .map(([name, applied]) => ({ name, applied, value: root.getAttribute(name) }));
  let acquired = false;
  let inertAttempted = false;
  let released = false;
  return { acquire() {
    if (released) throw new Error('global_sentinel_page_isolation_released');
    if (acquired) return;
    // The Host stores this prepared lease before any mutation, so even a
    // throwing DOM setter leaves an addressable exact restoration owner.
    for (const entry of styles) {
      entry.attempted = true;
      entry.element.style.setProperty(entry.name, entry.applied, 'important');
    }
    for (const entry of attributes) {
      entry.attempted = true;
      root.setAttribute(entry.name, entry.applied);
    }
    inertAttempted = true;
    body.inert = true;
    acquired = true;
  }, release() {
    if (released) return;
    if (inertAttempted) {
      if (body.inert === true) body.inert = previousInert;
      inertAttempted = false;
    }
    for (const entry of styles) {
      if (!entry.attempted) continue;
      if (entry.element.style.getPropertyValue(entry.name) === entry.applied
        && entry.element.style.getPropertyPriority(entry.name) === 'important') {
        if (entry.value) entry.element.style.setProperty(entry.name, entry.value, entry.priority);
        else entry.element.style.removeProperty(entry.name);
      }
      entry.attempted = false;
    }
    for (const entry of attributes) {
      if (!entry.attempted) continue;
      if (root.getAttribute(entry.name) === entry.applied) {
        if (entry.value === null) root.removeAttribute(entry.name);
        else root.setAttribute(entry.name, entry.value);
      }
      entry.attempted = false;
    }
    released = true;
  } };
}
