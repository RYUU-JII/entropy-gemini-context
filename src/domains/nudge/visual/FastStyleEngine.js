let activeMutationRecorder = null;

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function normalizeMutationRecorder(recorder) {
  if (recorder === null || recorder === undefined) return null;
  if (typeof recorder === 'function') {
    return {
      record: recorder,
      attributeNames: null,
      includeText: true,
      changedOnly: false,
      measureEvidenceRead: true,
    };
  }
  if (!recorder || typeof recorder !== 'object' || typeof recorder.record !== 'function') {
    throw new Error('FAST_STYLE_MUTATION_RECORDER_INVALID');
  }
  const attributeNames = recorder.attributeNames;
  if (
    attributeNames !== null
    && attributeNames !== undefined
    && !(attributeNames instanceof Set)
  ) {
    throw new Error('FAST_STYLE_MUTATION_ATTRIBUTE_INTEREST_INVALID');
  }
  return {
    record: recorder.record,
    attributeNames: attributeNames || null,
    includeText: recorder.includeText !== false,
    changedOnly: recorder.changedOnly === true,
    measureEvidenceRead: recorder.measureEvidenceRead === true,
  };
}

/**
 * Runs synchronous DOM work with an exact mutation-attempt recorder. The
 * recorder is scoped and stack-safe so feature owners can measure writes and
 * suppress their own observer echoes without turning this module into a store.
 */
export function runWithFastStyleMutationRecorder(recorder, operation) {
  if (typeof operation !== 'function') {
    throw new Error('FAST_STYLE_MUTATION_OPERATION_REQUIRED');
  }
  const previousRecorder = activeMutationRecorder;
  activeMutationRecorder = normalizeMutationRecorder(recorder);
  try {
    return operation();
  } finally {
    activeMutationRecorder = previousRecorder;
  }
}

function recordAttributeAttempt(target, name, expectedValue, changed, operation) {
  const recorder = activeMutationRecorder;
  if (!recorder) return;
  if (recorder.changedOnly && !changed) return;
  if (recorder.attributeNames && !recorder.attributeNames.has(name)) return;
  recorder.record({
    kind: 'attribute',
    target,
    name,
    expectedValue,
    changed,
    operation,
  });
}

function recordCurrentAttributeAttempt(target, name, changed, operation) {
  const recorder = activeMutationRecorder;
  if (!recorder) return;
  if (recorder.changedOnly && !changed) return;
  if (recorder.attributeNames && !recorder.attributeNames.has(name)) return;
  const evidenceStartedAt = recorder.measureEvidenceRead ? nowMs() : 0;
  const expectedValue = target.getAttribute?.(name) ?? null;
  const evidenceReadMs = recorder.measureEvidenceRead
    ? Math.max(0, nowMs() - evidenceStartedAt)
    : 0;
  recorder.record({
    kind: 'attribute',
    target,
    name,
    expectedValue,
    evidenceReadMs,
    changed,
    operation,
  });
}

function recordTextAttempt(target, expectedText, changed, operation) {
  const recorder = activeMutationRecorder;
  if (!recorder || !recorder.includeText) return;
  if (recorder.changedOnly && !changed) return;
  recorder.record({
    kind: 'childList',
    target,
    expectedText,
    changed,
    operation,
  });
}

export function setRootAttribute(attr, value) {
  const root = document.documentElement;
  if (!root) return false;
  const nextValue = String(value);
  const changed = root.getAttribute(attr) !== nextValue;
  if (changed) root.setAttribute(attr, nextValue);
  recordAttributeAttempt(root, attr, nextValue, changed, 'set');
  return changed;
}

export function removeRootAttribute(attr) {
  const root = document.documentElement;
  if (!root) return false;
  const changed = root.hasAttribute(attr);
  if (changed) root.removeAttribute(attr);
  recordAttributeAttempt(root, attr, null, changed, 'remove');
  return changed;
}

export function setRootStyle(name, value) {
  const root = document.documentElement;
  if (!root) return false;
  const nextValue = String(value);
  const changed = root.style.getPropertyValue(name) !== nextValue
    || !!root.style.getPropertyPriority(name);
  if (changed) root.style.setProperty(name, value);
  recordCurrentAttributeAttempt(root, 'style', changed, 'style:set');
  return changed;
}

export function removeRootStyle(name) {
  const root = document.documentElement;
  if (!root) return false;
  const changed = !!(
    root.style.getPropertyValue(name)
    || root.style.getPropertyPriority(name)
  );
  if (changed) root.style.removeProperty(name);
  recordCurrentAttributeAttempt(root, 'style', changed, 'style:remove');
  return changed;
}

export function setInlineStyle(el, name, value) {
  if (!el || !el.style) return false;
  const nextValue = String(value ?? '');
  const changed = el.style[name] !== nextValue;
  if (changed) el.style[name] = nextValue;
  recordCurrentAttributeAttempt(el, 'style', changed, 'style:set');
  return changed;
}

export function removeInlineStyle(el, name) {
  if (!el || !el.style) return false;
  const changed = !!el.style[name];
  if (changed) el.style[name] = '';
  recordCurrentAttributeAttempt(el, 'style', changed, 'style:remove');
  return changed;
}

export function setStyleProperty(el, name, value) {
  if (!el || !el.style) return false;
  let changed = false;
  if (value === null || value === undefined) {
    changed = !!(
      el.style.getPropertyValue(name)
      || el.style.getPropertyPriority(name)
    );
    if (changed) el.style.removeProperty(name);
    recordCurrentAttributeAttempt(el, 'style', changed, 'style:remove');
    return changed;
  }
  changed = el.style.getPropertyValue(name) !== String(value)
    || !!el.style.getPropertyPriority(name);
  if (changed) el.style.setProperty(name, value);
  recordCurrentAttributeAttempt(el, 'style', changed, 'style:set');
  return changed;
}

export function removeStyleProperty(el, name) {
  if (!el || !el.style) return false;
  const changed = !!(
    el.style.getPropertyValue(name)
    || el.style.getPropertyPriority(name)
  );
  if (changed) el.style.removeProperty(name);
  recordCurrentAttributeAttempt(el, 'style', changed, 'style:remove');
  return changed;
}

export function applyInlineStyles(el, styles) {
  if (!el || !el.style || !styles) return false;
  let changedAny = false;
  for (const key in styles) {
    if (!Object.prototype.hasOwnProperty.call(styles, key)) continue;
    const value = styles[key];
    const nextValue = String(value ?? '');
    const changed = el.style[key] !== nextValue;
    if (changed) {
      el.style[key] = nextValue;
      changedAny = true;
    }
    recordCurrentAttributeAttempt(el, 'style', changed, 'style:set');
  }
  return changedAny;
}

export function toggleClass(el, className, enabled) {
  if (!el || !el.classList) return false;
  const nextEnabled = !!enabled;
  const changed = el.classList.contains(className) !== nextEnabled;
  if (changed) el.classList.toggle(className, nextEnabled);
  recordCurrentAttributeAttempt(el, 'class', changed, 'class:toggle');
  return changed;
}

export function addClass(el, className) {
  if (!el || !el.classList) return false;
  const changed = !el.classList.contains(className);
  if (changed) el.classList.add(className);
  recordCurrentAttributeAttempt(el, 'class', changed, 'class:add');
  return changed;
}

export function removeClass(el, className) {
  if (!el || !el.classList) return false;
  const changed = el.classList.contains(className);
  if (changed) el.classList.remove(className);
  recordCurrentAttributeAttempt(el, 'class', changed, 'class:remove');
  return changed;
}

export function setAttribute(el, name, value) {
  if (!el) return false;
  if (value === null || value === undefined) {
    const changed = el.hasAttribute(name);
    if (changed) el.removeAttribute(name);
    recordAttributeAttempt(el, name, null, changed, 'remove');
    return changed;
  }
  const nextValue = String(value);
  const changed = el.getAttribute(name) !== nextValue;
  if (changed) el.setAttribute(name, nextValue);
  recordAttributeAttempt(el, name, nextValue, changed, 'set');
  return changed;
}

export function removeAttribute(el, name) {
  if (!el) return false;
  const changed = el.hasAttribute(name);
  if (changed) el.removeAttribute(name);
  recordAttributeAttempt(el, name, null, changed, 'remove');
  return changed;
}

export function setText(el, text) {
  if (!el) return false;
  const nextText = String(text ?? '');
  const changed = el.textContent !== nextText;
  if (changed) el.textContent = nextText;
  recordTextAttempt(el, nextText, changed, 'text:set');
  return changed;
}

export function setTextNode(node, text) {
  const owner = node?.parentElement || node?.parentNode;
  if (!node || node.nodeType !== 3 || !owner || owner.nodeType !== 1) {
    throw new Error('FAST_STYLE_TEXT_NODE_OWNER_REQUIRED');
  }
  const nextText = String(text ?? '');
  const changed = node.nodeValue !== nextText;
  if (changed) node.nodeValue = nextText;
  recordTextAttempt(owner, owner.textContent || '', changed, 'text-node:set');
  return changed;
}
