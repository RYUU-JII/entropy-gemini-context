const TEXT_ENTRY_TARGET_SELECTOR = [
  'input',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true" i]',
  '[contenteditable="plaintext-only" i]',
  '[role="textbox"]',
  '[role="searchbox"]',
  '[role="combobox"]',
].join(', ');

function isTextEntryTarget(node) {
  return node?.nodeType === 1 && (
    node.isContentEditable === true
    || !!node.closest?.(TEXT_ENTRY_TARGET_SELECTOR)
  );
}

// Native event context only: preserving an editor's keyboard does not classify
// the person's intent, reading, or content consumption.
export function isTextEntryKeyboardEvent(event) {
  if (event?.isComposing || event?.keyCode === 229 || event?.key === 'Process') return true;
  // At window capture, a shadow editor's target may already be its host.
  // The composed path still carries the originating input in an open root.
  const path = event?.composedPath?.();
  return isTextEntryTarget(event?.target)
    || (Array.isArray(path) && path.some(isTextEntryTarget));
}
