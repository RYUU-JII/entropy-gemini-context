export const MAIN_PRESENTATION_FOCUS_TAB_ID = 'main';

export function isMainPresentationFocusActive(mainPresentationDecision = null) {
  return mainPresentationDecision?.session?.selectionLocked === true;
}
