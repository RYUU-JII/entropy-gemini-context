const EDITOR_SELECTOR = 'textarea, input, [contenteditable], [role="textbox"], [role="searchbox"]';
// This observation seam is narrower than keyboard protection. A password,
// select/button or inaccessible child frame is not an observed text editor.
export function isObservedEditorTarget(node) {
  if (node?.nodeType !== 1) return false;
  const editor = node.closest(EDITOR_SELECTOR);
  if (!editor) return false;
  if (editor.tagName === 'INPUT') return ['text', 'search', 'email', 'url', 'tel', 'number'].includes(editor.type);
  if (editor.getAttribute('contenteditable')?.toLowerCase() === 'false') return false;
  return true;
}
export function isObservedEditorInput(event) {
  const path = event.composedPath();
  return isObservedEditorTarget(path.find((node) => node?.nodeType === 1));
}
export function readEditorObservationState(documentRef) {
  if (documentRef.visibilityState !== 'visible') return { available: false, focused: null };
  let node = documentRef.activeElement;
  let depth = 0;
  while (node?.shadowRoot?.activeElement && depth < 32) {
    node = node.shadowRoot.activeElement; depth += 1;
  }
  if (depth === 32 || node?.tagName === 'IFRAME') return { available: false, focused: null };
  return { available: true, focused: isObservedEditorTarget(node) };
}
