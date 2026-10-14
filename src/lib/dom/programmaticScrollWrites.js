// Document-local facts about app-owned native writes. Readers retain independent
// revisions; reads never consume or expire facts. No DOM identity is published.
const writesByScroller = new WeakMap();
const NO_WRITES = Object.freeze({ revision: 0, inProgress: false,
  adjustmentRevision: 0, adjustmentInProgress: false });

function canonicalScroller(scroller, documentRef) {
  if (!scroller || typeof scroller !== 'object' || !documentRef
    || (scroller.ownerDocument && scroller.ownerDocument !== documentRef)) {
    throw new Error('PROGRAMMATIC_SCROLL_SCROLLER_INVALID');
  }
  const root = documentRef.scrollingElement || documentRef.documentElement;
  const resolved = scroller === documentRef || scroller === documentRef.defaultView
    || scroller === documentRef.documentElement || scroller === documentRef.body ? root : scroller;
  if (!resolved || resolved.ownerDocument !== documentRef) {
    throw new Error('PROGRAMMATIC_SCROLL_SCROLLER_INVALID');
  }
  return resolved;
}

export function readProgrammaticScrollWriteState(scroller, documentRef) {
  const state = writesByScroller.get(canonicalScroller(scroller, documentRef));
  return state ? { revision: state.revision, inProgress: state.depth > 0,
    adjustmentRevision: state.adjustmentRevision, adjustmentInProgress: state.adjustmentDepth > 0 } : NO_WRITES;
}

export function writeProgrammaticScroll({ scroller, windowRef, documentRef, top, left, relative = false, purpose }) {
  const target = canonicalScroller(scroller, documentRef);
  if (!Number.isFinite(top) || (left !== undefined && !Number.isFinite(left))
    || typeof relative !== 'boolean') throw new Error('PROGRAMMATIC_SCROLL_POSITION_INVALID');
  if (purpose !== 'input_assistance' && purpose !== 'effect_adjustment') {
    throw new Error('PROGRAMMATIC_SCROLL_PURPOSE_INVALID');
  }
  const root = documentRef.scrollingElement || documentRef.documentElement;
  const receiver = target === root ? windowRef : target;
  const method = relative ? 'scrollBy' : 'scrollTo';
  if (typeof receiver?.[method] !== 'function') throw new Error('PROGRAMMATIC_SCROLL_API_UNAVAILABLE');
  let state = writesByScroller.get(target);
  if (!state) {
    state = { revision: 0, depth: 0, adjustmentRevision: 0, adjustmentDepth: 0 };
    writesByScroller.set(target, state);
  }
  if (state.revision >= Number.MAX_SAFE_INTEGER - 2) throw new Error('PROGRAMMATIC_SCROLL_REVISION_EXHAUSTED');
  state.revision += 1;
  state.depth += 1;
  const adjustment = purpose === 'effect_adjustment';
  if (adjustment) { state.adjustmentRevision += 1; state.adjustmentDepth += 1; }
  try {
    // "auto" can inherit site smooth scrolling. Explicit instant writes close
    // their physical movement before the finally boundary, including each frame.
    const options = { top, behavior: 'instant' };
    if (left !== undefined) options.left = left;
    receiver[method](options);
  } finally {
    // A throwing setter/API may already have moved the page. Do not roll back
    // the discontinuity or let a later read label that interval as native input.
    state.depth -= 1;
    state.revision += 1;
    if (adjustment) { state.adjustmentDepth -= 1; state.adjustmentRevision += 1; }
  }
}
