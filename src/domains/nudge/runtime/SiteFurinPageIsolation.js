// The surface arbiter owns input policy. This owner additionally freezes native
// page scrolling and excludes page controls from keyboard/focus navigation.
export function createSiteFurinPageIsolation({ documentRef = document, root }) {
  const body = documentRef.body;
  if (!body || !root?.isConnected) throw new Error('site_furin_page_isolation_root_required');
  const previousFocus = documentRef.activeElement;
  const inert = body.inert;
  const styles = [];
  for (const element of [documentRef.documentElement, body]) {
    for (const [name,value] of [['overflow','hidden'],['overscroll-behavior','none']]) {
      styles.push({ element, name, value:element.style.getPropertyValue(name), priority:element.style.getPropertyPriority(name), applied:value });
      element.style.setProperty(name,value,'important');
    }
  }
  body.inert = true;
  root.tabIndex = -1;
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.focus({preventScroll:true});
  const trap = event => {
    if (event.key !== 'Tab') return;
    const buttons = [...root.shadowRoot.querySelectorAll('#nudgeFurinWind,#nudgeFurinContinue')]
      .filter(node => !node.disabled && node.getClientRects().length > 0);
    const focused = root.shadowRoot.activeElement;
    if (!buttons.length) { event.preventDefault(); root.focus({preventScroll:true}); return; }
    if (event.shiftKey && (focused === buttons[0] || !buttons.includes(focused))) {
      event.preventDefault(); buttons.at(-1).focus({preventScroll:true});
    } else if (!event.shiftKey && (focused === buttons.at(-1) || !buttons.includes(focused))) {
      event.preventDefault(); buttons[0].focus({preventScroll:true});
    }
  };
  root.addEventListener('keydown',trap);
  let released = false;
  return { release() {
    if (released) return;
    released = true;
    root.removeEventListener('keydown',trap);
    // Restore only values still owned by this isolation lease.
    if (body.inert === true) body.inert = inert;
    for (const entry of styles) if (entry.element.style.getPropertyValue(entry.name) === entry.applied) {
      if (entry.value) entry.element.style.setProperty(entry.name,entry.value,entry.priority);
      else entry.element.style.removeProperty(entry.name);
    }
    if (previousFocus?.isConnected && (documentRef.activeElement === root || documentRef.activeElement === body)) {
      previousFocus.focus?.({preventScroll:true});
    }
  } };
}
